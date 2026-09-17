// ==============================================================================
// SERVIDOR MCP (Model Context Protocol) — TRANSPORTE STREAMABLE HTTP
// ==============================================================================
// POR QUE ESTE ARQUIVO EXISTE:
//
// O conector do Claude foi apontado para /api/vmo/state. Aquele endpoint é uma
// API REST comum: devolve { sucesso: true, dados: {...} }. O Claude consegue
// registrá-lo como "conector", mas nunca encontra nenhuma ferramenta nele,
// porque MCP não é REST — é JSON-RPC 2.0 com três métodos obrigatórios:
//
//   initialize   -> apresenta o servidor e negocia a versão do protocolo
//   tools/list   -> lista as ferramentas disponíveis
//   tools/call   -> executa uma ferramenta
//
// Sem esses métodos o servidor aparece conectado e sem nenhuma tool — que é
// exatamente o sintoma observado. Este arquivo implementa o protocolo e expõe
// as operações do VMO como ferramentas de verdade.
//
// O endpoint REST continua existindo e funcionando: este é um canal novo,
// paralelo, servido em /api/mcp. Os dois compartilham a mesma lógica de
// estado (lib/vmoState.ts) e a mesma API key (lib/apiAuth.ts).
// ==============================================================================

import { loadState, saveState, applyIncomingUpdates } from './vmoState.js';
import { isAuthorized } from './apiAuth.js';

// Versões do protocolo que sabemos falar. Devolvemos a que o cliente pedir
// quando ela estiver aqui; caso contrário, caímos na mais recente conhecida.
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

const SERVER_INFO = {
  name: 'vmo-exed',
  title: 'VMO Corporativo — Exed Consulting',
  version: '1.1.0'
};

// ------------------------------------------------------------------ JSON-RPC

const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INTERNAL_ERROR = -32603;

function rpcResult(id: any, result: any) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: any, code: number, message: string, data?: any) {
  return { jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } };
}

/** Resultado de uma tool: texto simples, no formato que o MCP espera. */
function toolText(payload: any, isError = false) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text', text }], isError };
}

// ---------------------------------------------------------------- Ferramentas

const TOOLS = [
  {
    name: 'ler_estado_vmo',
    title: 'Ler estado do VMO',
    description:
      'Lê o estado atual do webapp VMO. Use o parâmetro "secao" para trazer só uma parte e ' +
      'evitar respostas gigantes. "resumo" devolve apenas os totais consolidados.',
    inputSchema: {
      type: 'object',
      properties: {
        secao: {
          type: 'string',
          enum: ['resumo', 'projetos', 'clientes', 'historico_mensal', 'projetos_sem_atualizacao', 'catalogo', 'instrucoes', 'configuracao', 'tudo'],
          description: 'Parte do estado a retornar. Padrão: "resumo".'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'listar_projetos',
    title: 'Listar projetos (compacto)',
    description:
      'Lista os projetos em formato reduzido (id, código, nome, cliente, solução, status, margem). ' +
      'Use antes de escrever, para saber o que já existe e não duplicar.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['ATIVO', 'ENCERRADO', 'DEMONSTRATIVO'],
          description: 'Filtra por status. Omita para trazer todos.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'substituir_projetos',
    title: 'Substituir a lista de projetos',
    description:
      'ATENÇÃO: SUBSTITUI A LISTA INTEIRA de projetos, não faz merge. Envie SEMPRE o array ' +
      'completo, incluindo os projetos que já existiam e não mudaram — enviar só os alterados ' +
      'APAGA todos os outros. Rode listar_projetos antes para conferir. ' +
      'O campo "id" de cada projeto deve ser o "Project ID (S4 Public Exed)" de dentro da ' +
      'planilha, nunca o nome do arquivo: é ele que amarra o projeto ao seu histórico. ' +
      'Grave o mesmo valor em projectIdS4 (ou projectIdMissing: true quando a RSE não tiver o ID). ' +
      'solution é a chave da solução (RISE, GROW, SCE, SCP, FSW ou DSC), vinda do Project Portfolio. ' +
      'front é a chave da frente (RISE, GROW, IBP, SUPPLY_CHAIN ou FABRICA), definida projeto a projeto ' +
      'pelo NOME do gerente de portfólio conforme o catálogo (ler_estado_vmo secao="catalogo"); frente ' +
      'fixada pelo PMO (frontManual) é mantida. A solução nunca decide a frente. ' +
      'Clientes que não existirem são cadastrados ' +
      'automaticamente. Lista vazia só apaga com confirmarLimpeza: true.',
    inputSchema: {
      type: 'object',
      properties: {
        projetos: {
          type: 'array',
          description: 'Array completo de projetos no formato SapProjectFinancial.',
          items: { type: 'object' }
        },
        confirmarLimpeza: {
          type: 'boolean',
          description: 'Só com true uma lista vazia apaga os projetos existentes.'
        }
      },
      required: ['projetos'],
      additionalProperties: false
    }
  },
  {
    name: 'upsert_historico_mensal',
    title: 'Inserir/atualizar histórico mensal',
    description:
      'Faz MERGE por monthKey (YYYY-MM) no histórico mensal — não apaga os meses já gravados, ' +
      'então é seguro para carga incremental. É este histórico que alimenta TODOS os comparativos ' +
      '"vs mês anterior" das quatro páginas do dashboard. ' +
      'Obrigatórios: monthKey, year, month, revenueBilled (R$ DAQUELE mês, NÃO acumulado) e ' +
      'marginAvg (%). Os demais campos são opcionais e cada um liga um comparativo. ' +
      'REGRA DE OURO: campo sem dado deve ser OMITIDO, nunca enviado como zero — zero vira uma ' +
      'variação real no relatório executivo, ausente vira "—". ' +
      'Inclua projectSnapshots para que a coluna "Comparativo Mês Ant." das tabelas seja calculada ' +
      'em vez de digitada à mão pelo PMO.',
    inputSchema: {
      type: 'object',
      properties: {
        meses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              monthKey: { type: 'string', description: 'YYYY-MM, ex: "2026-03"' },
              year: { type: 'number' },
              month: { type: 'number', description: '1 a 12' },
              revenueBilled: { type: 'number', description: 'Faturamento do mês em R$, NÃO acumulado' },
              marginAvg: { type: 'number', description: 'Margem média do mês em %' },

              // Opcionais — One Page
              totalSpend: { type: 'number', description: 'Gasto/uso de orçamento total do mês (R$)' },
              clientsServed: { type: 'number', description: 'Clientes distintos atendidos no mês' },
              goLivesCompleted: { type: 'number', description: 'Go-lives concluídos no mês' },
              activeProjects: { type: 'number', description: 'Projetos ativos no mês' },

              // Opcionais — Pontos de Atenção
              avgScheduleDelay: { type: 'number', description: 'Atraso médio de cronograma no mês (%)' },
              signedDocsAvg: { type: 'number', description: '% médio de documentação assinada' },
              detractorCount: { type: 'number', description: 'Projetos abaixo da referência de receita ou margem' },

              // Opcionais — Informações Gerais
              almAdoptionPercent: { type: 'number', description: '% de projetos usando SAP Cloud ALM' },
              openCrCount: { type: 'number', description: 'Quantidade de CRs em aberto' },
              openCrValue: { type: 'number', description: 'Valor somado das CRs em aberto (R$)' },
              npsAvg: { type: 'number', description: 'NPS médio do mês (0 a 10)' },

              // Opcionais — Detalhamento Financeiro
              plannedBudgetTotal: { type: 'number', description: 'Uso de orçamento planejado total (R$)' },
              reimbursableTotal: { type: 'number', description: 'Total de gasto reembolsável do mês (R$)' },

              // Detalhe por projeto: habilita o comparativo por linha das tabelas
              projectSnapshots: {
                type: 'array',
                description:
                  'Um item por projeto daquele mês. projectId DEVE ser o "Project ID (S4 Public Exed)" ' +
                  'de dentro da planilha, nunca o nome do arquivo. Com dois meses preenchidos, a ' +
                  'variação por projeto passa a ser calculada automaticamente.',
                items: {
                  type: 'object',
                  properties: {
                    projectId: { type: 'string', description: 'Project ID (S4 Public Exed)' },
                    client: { type: 'string' },
                    solution: { type: 'string', description: 'Chave da solução' },
                    front: { type: 'string', description: 'Chave da frente' },
                    budgetRealized: { type: 'number', description: 'Uso de orçamento real no mês (R$)' },
                    billed: { type: 'number', description: 'Faturado acumulado do projeto até o fechamento do mês (R$)' },
                    marginPercent: { type: 'number', description: 'Margem do projeto no mês (%)' },
                    reimbursableExpenseTotal: { type: 'number', description: 'Gasto reembolsável do projeto no mês (R$)' }
                  },
                  required: ['projectId'],
                  additionalProperties: false
                }
              }
            },
            required: ['monthKey', 'year', 'month', 'revenueBilled', 'marginAvg'],
            additionalProperties: false
          }
        }
      },
      required: ['meses'],
      additionalProperties: false
    }
  },
  {
    name: 'atualizar_estado_vmo',
    title: 'Atualizar estado do VMO (genérico)',
    description:
      'Aplica um payload parcial no estado, com a mesma semântica do POST /api/vmo/state. ' +
      'Aceita chaves em português ou inglês (projetos/projects, clientes/clients, ' +
      'historico_mensal/monthlyHistory, etc). Prefira as ferramentas específicas quando existirem.',
    inputSchema: {
      type: 'object',
      properties: {
        payload: { type: 'object', description: 'Campos a atualizar.' }
      },
      required: ['payload'],
      additionalProperties: false
    }
  },
  {
    name: 'registrar_projetos_sem_atualizacao',
    title: 'Registrar projetos sem atualização do GP',
    description:
      'Registra os projetos cuja RSE mais recente tem Status Date fora do mês migrado (o GP não ' +
      'atualizou). Esses projetos NÃO entram no histórico nem na lista de projetos do mês e ' +
      'aparecem em Pontos de Atenção. Substitui os registros do mesmo mesReferencia e mantém os ' +
      'dos outros meses. Envie projetos: [] para limpar o mês. Os clientes citados são cadastrados.',
    inputSchema: {
      type: 'object',
      properties: {
        mesReferencia: { type: 'string', description: 'AAAA-MM do mês em que a atualização faltou' },
        projetos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: 'Project ID (S4) ou chave provisória' },
              projectIdS4: { type: 'string' },
              name: { type: 'string' },
              client: { type: 'string' },
              solution: { type: 'string', description: 'Chave da solução' },
              front: { type: 'string', description: 'Chave da frente' },
              projectManager: { type: 'string' },
              portfolioManager: { type: 'string' },
              lastStatusDate: { type: 'string', description: 'Último Status Date encontrado (AAAA-MM-DD)' },
              sourceFile: { type: 'string', description: 'Arquivo onde a atualização era esperada' },
              notes: { type: 'string' }
            },
            required: ['projectId', 'name']
          }
        }
      },
      required: ['mesReferencia', 'projetos'],
      additionalProperties: false
    }
  }
];

function resumoDe(state: any) {
  const totalOrcado = state.projects.reduce((a: number, p: any) => a + (p.budgetPlanned || 0), 0);
  const totalRealizado = state.projects.reduce((a: number, p: any) => a + (p.budgetRealized || 0), 0);
  const totalFaturado = state.projects.reduce((a: number, p: any) => a + (p.billed || 0), 0);
  return {
    total_projetos: state.projects.length,
    total_clientes: (state.clients || []).length,
    meses_no_historico: (state.monthlyHistory || []).length,
    total_orcado_brl: totalOrcado,
    total_realizado_brl: totalRealizado,
    total_faturado_brl: totalFaturado,
    desvio_custo_consolidado_percentual:
      totalOrcado > 0 ? Number((((totalRealizado - totalOrcado) / totalOrcado) * 100).toFixed(2)) : 0,
    projetos_sem_project_id_s4: state.projects.filter((p: any) => !p.projectIdS4).map((p: any) => p.id),
    projetos_sem_atualizacao: (state.projetosSemAtualizacao || []).length,
    versao_instrucoes: state.instrucoesVersao ?? null,
    periodo_referencia: state.referencePeriod,
    ultima_atualizacao: state.lastSaved,
    atualizado_por: state.updatedBy || null
  };
}

async function executarTool(name: string, args: any) {
  switch (name) {
    case 'ler_estado_vmo': {
      const state = await loadState();
      const secao = args?.secao || 'resumo';
      if (secao === 'resumo') return toolText(resumoDe(state));
      if (secao === 'projetos') return toolText(state.projects);
      if (secao === 'clientes') return toolText(state.clients || []);
      if (secao === 'historico_mensal') return toolText(state.monthlyHistory || []);
      if (secao === 'projetos_sem_atualizacao') return toolText(state.projetosSemAtualizacao || []);
      if (secao === 'catalogo') return toolText(state.catalogoPortfolio);
      if (secao === 'instrucoes') {
        return toolText({
          versao: state.instrucoesVersao ?? null,
          instrucoesPreenchimento: state.instrucoesPreenchimento,
          localDosDados: state.localDosDados,
          catalogoPortfolio: state.catalogoPortfolio
        });
      }
      if (secao === 'configuracao') {
        return toolText({
          containerSettings: state.containerSettings,
          widgets: state.widgets,
          pageLayout: state.pageLayout,
          containerLayout: state.containerLayout,
          theme: state.theme,
          sharePointLinks: state.sharePointLinks,
          instrucoesPreenchimento: state.instrucoesPreenchimento,
          localDosDados: state.localDosDados,
          catalogoPortfolio: state.catalogoPortfolio
        });
      }
      return toolText(state);
    }

    case 'listar_projetos': {
      const state = await loadState();
      let projetos = state.projects || [];
      if (args?.status) projetos = projetos.filter((p: any) => p.status === args.status);
      return toolText(
        projetos.map((p: any) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          client: p.client,
          solution: p.solution,
          front: p.front ?? null,
          status: p.status ?? null,
          marginPercent: p.marginPercent,
          billed: p.billed,
          closureDate: p.closureDate ?? null
        }))
      );
    }

    case 'substituir_projetos': {
      if (!Array.isArray(args?.projetos)) {
        return toolText('Erro: "projetos" precisa ser um array.', true);
      }
      const state = await loadState();
      const antes = state.projects.length;
      const resultado = applyIncomingUpdates(state, {
        projects: args.projetos,
        confirmarLimpeza: args.confirmarLimpeza === true
      });
      state.updatedBy = 'claude-mcp';
      const gravacao = await saveState(state);
      return toolText({
        sucesso: gravacao.bloqueios.length === 0 && resultado.ignorados.length === 0,
        projetos_antes: antes,
        projetos_depois: state.projects.length,
        clientes_cadastrados: resultado.clientesCadastrados,
        avisos: resultado.avisos,
        ignorados: resultado.ignorados,
        bloqueados_pelo_banco: gravacao.bloqueios,
        ultima_atualizacao: state.lastSaved,
        lembrete: 'Confira em vmo_app_state antes de reportar ao usuário.'
      });
    }

    case 'upsert_historico_mensal': {
      if (!Array.isArray(args?.meses) || args.meses.length === 0) {
        return toolText('Erro: "meses" precisa ser um array não vazio.', true);
      }
      const state = await loadState();
      applyIncomingUpdates(state, { monthlyHistory: args.meses });
      state.updatedBy = 'claude-mcp';
      const gravacao = await saveState(state);
      return toolText({
        sucesso: gravacao.bloqueios.length === 0,
        meses_no_historico: (state.monthlyHistory || []).length,
        chaves: (state.monthlyHistory || []).map((m: any) => m.monthKey),
        bloqueados_pelo_banco: gravacao.bloqueios,
        ultima_atualizacao: state.lastSaved
      });
    }

    case 'registrar_projetos_sem_atualizacao': {
      const mes = String(args?.mesReferencia || '');
      if (!/^\d{4}-\d{2}$/.test(mes) || !Array.isArray(args?.projetos)) {
        return toolText('Erro: informe mesReferencia (AAAA-MM) e projetos (array).', true);
      }
      const state = await loadState();
      const agora = new Date().toISOString();
      const doMes = args.projetos.map((p: any) => ({ ...p, monthKey: mes, detectedAt: p?.detectedAt || agora }));
      const outrosMeses = (state.projetosSemAtualizacao || []).filter((p: any) => p.monthKey !== mes);
      const lista = [...outrosMeses, ...doMes];
      const resultado = applyIncomingUpdates(state, {
        projetosSemAtualizacao: lista,
        confirmarLimpeza: lista.length === 0
      });
      state.updatedBy = 'claude-mcp';
      const gravacao = await saveState(state);
      return toolText({
        sucesso: gravacao.bloqueios.length === 0,
        mes,
        projetos_no_mes: doMes.length,
        total_registrado: (state.projetosSemAtualizacao || []).length,
        clientes_cadastrados: resultado.clientesCadastrados,
        bloqueados_pelo_banco: gravacao.bloqueios,
        ultima_atualizacao: state.lastSaved
      });
    }

    case 'atualizar_estado_vmo': {
      if (!args?.payload || typeof args.payload !== 'object') {
        return toolText('Erro: "payload" precisa ser um objeto.', true);
      }
      const state = await loadState();
      const resultado = applyIncomingUpdates(state, args.payload);
      state.updatedBy = 'claude-mcp';
      const gravacao = await saveState(state);
      return toolText({
        sucesso: gravacao.bloqueios.length === 0 && resultado.ignorados.length === 0,
        total_projetos: state.projects.length,
        total_clientes: (state.clients || []).length,
        meses_no_historico: (state.monthlyHistory || []).length,
        clientes_cadastrados: resultado.clientesCadastrados,
        avisos: resultado.avisos,
        ignorados: resultado.ignorados,
        bloqueados_pelo_banco: gravacao.bloqueios,
        ultima_atualizacao: state.lastSaved
      });
    }

    default:
      return toolText(`Ferramenta desconhecida: ${name}`, true);
  }
}

// ------------------------------------------------------------- Roteador JSON-RPC

async function tratarMensagem(msg: any): Promise<any | null> {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id ?? null, JSONRPC_INVALID_REQUEST, 'Requisição JSON-RPC inválida.');
  }

  const { id, method, params } = msg;
  // Notificações (sem id) não geram resposta — apenas 202 Accepted.
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case 'initialize': {
        const pedida = params?.protocolVersion;
        const versao = SUPPORTED_PROTOCOL_VERSIONS.includes(pedida) ? pedida : DEFAULT_PROTOCOL_VERSION;
        return rpcResult(id, {
          protocolVersion: versao,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            'Servidor do VMO Corporativo da Exed. Antes de migrar, leia o manual com ler_estado_vmo ' +
            '(secao="instrucoes"). Sempre chame ler_estado_vmo (secao="resumo") ou ' +
            'listar_projetos antes de escrever. substituir_projetos troca o array inteiro — envie ' +
            'a lista completa. upsert_historico_mensal faz merge por monthKey e é seguro para ' +
            'atualizações incrementais.'
        });
      }

      case 'notifications/initialized':
      case 'notifications/cancelled':
        return null;

      case 'ping':
        return isNotification ? null : rpcResult(id, {});

      case 'tools/list':
        return rpcResult(id, { tools: TOOLS });

      case 'tools/call': {
        const nome = params?.name;
        if (typeof nome !== 'string') {
          return rpcError(id, JSONRPC_INVALID_REQUEST, 'params.name ausente em tools/call.');
        }
        const resultado = await executarTool(nome, params?.arguments ?? {});
        return rpcResult(id, resultado);
      }

      // Declaramos apenas a capability "tools", mas alguns clientes sondam
      // estes métodos mesmo assim. Responder vazio evita erro na inicialização.
      case 'resources/list':
        return rpcResult(id, { resources: [] });
      case 'prompts/list':
        return rpcResult(id, { prompts: [] });

      default:
        if (isNotification) return null;
        return rpcError(id, JSONRPC_METHOD_NOT_FOUND, `Método não suportado: ${method}`);
    }
  } catch (err: any) {
    if (isNotification) return null;
    return rpcError(id, JSONRPC_INTERNAL_ERROR, 'Erro interno no servidor MCP.', err?.message || String(err));
  }
}

// ------------------------------------------------------------------- Handler HTTP

function aplicarCorsMcp(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, x-api-key, X-API-Key, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, MCP-Protocol-Version');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function lerCorpo(req: any): any {
  const body = req.body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  return body;
}

/**
 * Handler único do endpoint MCP. Serve tanto a Serverless Function da Vercel
 * (/api/mcp.ts) quanto a rota do Express no desenvolvimento local.
 */
export async function handleMcpRequest(req: any, res: any): Promise<void> {
  aplicarCorsMcp(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET abriria um stream SSE para mensagens iniciadas pelo servidor. Este
  // servidor é stateless e só responde a requisições, então recusamos de forma
  // explícita — é um comportamento válido do Streamable HTTP.
  if (req.method === 'GET') {
    res.status(405).json(rpcError(null, JSONRPC_INVALID_REQUEST, 'Este servidor MCP não abre stream SSE. Use POST.'));
    return;
  }

  // DELETE encerraria a sessão. Como não há sessão, apenas confirmamos.
  if (req.method === 'DELETE') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET, DELETE, OPTIONS');
    res.status(405).json(rpcError(null, JSONRPC_INVALID_REQUEST, 'Método não permitido.'));
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json(
      rpcError(
        null,
        JSONRPC_INVALID_REQUEST,
        "API Key corporativa inválida ou ausente. Envie 'x-api-key: <CHAVE>', " +
          "'Authorization: Bearer <CHAVE>' ou acrescente ?apiKey=<CHAVE> na URL do conector."
      )
    );
    return;
  }

  const corpo = lerCorpo(req);
  if (corpo === undefined) {
    res.status(400).json(rpcError(null, JSONRPC_PARSE_ERROR, 'Corpo da requisição não é JSON válido.'));
    return;
  }

  // O transporte aceita uma mensagem ou um lote (array) de mensagens.
  if (Array.isArray(corpo)) {
    const respostas = (await Promise.all(corpo.map(tratarMensagem))).filter(r => r !== null);
    if (respostas.length === 0) {
      res.status(202).end();
      return;
    }
    res.status(200).json(respostas);
    return;
  }

  const resposta = await tratarMensagem(corpo);
  if (resposta === null) {
    res.status(202).end();
    return;
  }

  res.status(200).json(resposta);
}

export { TOOLS as MCP_TOOLS, SERVER_INFO as MCP_SERVER_INFO };
