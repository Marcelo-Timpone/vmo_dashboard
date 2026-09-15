import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { loadState, saveState, applyIncomingUpdates } from './lib/vmoState';
import { handleMcpRequest } from './lib/mcpServer';
import {
  getApiKeyStatus,
  isAuthorized,
  sendUnauthorized,
  setCorsHeaders
} from './lib/apiAuth';
import {
  findUserByUsername,
  verifyPassword,
  signSession,
  toPublicUser,
  requirePmoSession,
  getSessionFromRequest,
  listUsers,
  createUser,
  updateUser,
  deleteUser
} from './lib/auth';

// ==============================================================================
// SERVIDOR EXPRESS — USADO APENAS PARA DESENVOLVIMENTO LOCAL (`npm run dev`)
// ==============================================================================
// Em produção (Vercel), estas mesmas rotas são servidas por Serverless
// Functions em /api/vmo/*.ts, que reaproveitam a mesma lógica de
// ./lib/vmoState.ts e ./lib/apiAuth.ts — garantindo que o comportamento local
// e o de produção sejam idênticos.
const PORT = 3000;

async function startServer() {
  const app = express();

  // ============================================================================
  // ENDPOINT MCP (Model Context Protocol) — /api/mcp
  // ============================================================================
  // Precisa vir ANTES do middleware de CORS genérico: o MCP exige cabeçalhos
  // próprios no preflight (Mcp-Session-Id, MCP-Protocol-Version) que o CORS
  // genérico não declara. Se o OPTIONS fosse capturado lá em cima, o handshake
  // do conector falharia. Espelha /api/mcp.ts da Vercel.
  app.all('/api/mcp', express.json({ limit: '50mb' }), (req: Request, res: Response) => {
    handleMcpRequest(req, res);
  });

  // CORS para permitir chamadas do Claude / MCP / agentes corporativos
  app.use((req, res, next) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  // ============================================================================
  // MIDDLEWARE DE AUTENTICAÇÃO POR API KEY
  // ============================================================================
  const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (
      req.path === '/api/vmo/health' ||
      req.path === '/api/vmo/openapi.json' ||
      req.path === '/api/vmo/key-info'
    ) {
      return next();
    }

    if (isAuthorized(req)) {
      return next();
    }

    return sendUnauthorized(res);
  };

  // ============================================================================
  // ROTAS DA API CORPORATIVA EXED PARA O CLAUDE
  // ============================================================================

  // 1. Health & Status
  app.get('/api/vmo/health', async (_req, res) => {
    const state = await loadState();
    res.json({
      status: 'online',
      projeto: 'Exed Consulting - VMO Corporativo',
      versao_api: '1.0-claude-ready',
      timestamp: new Date().toISOString(),
      autenticacao: 'API Key (x-api-key ou Bearer)',
      projetos_cadastrados: state.projects.length,
      sharepoint_configurado: !!state.localDosDados
    });
  });

  // 2. Info de endpoints (para exibição no webapp)
  // SEGURANÇA: esta rota é pública e NÃO devolve o valor da chave. A versão
  // anterior devolvia `apiKey: getConfiguredApiKey()`, entregando a credencial
  // de produção a qualquer requisição anônima.
  app.get('/api/vmo/key-info', (_req, res) => {
    const status = getApiKeyStatus();
    res.json({
      sucesso: true,
      chave_configurada: status.configurada,
      como_obter_a_chave:
        'A chave é definida na variável de ambiente EXED_API_KEY do deploy. ' +
        'Peça ao responsável pela infraestrutura e cole em Configurações > API do Claude.',
      configuracao_pendente: status.configurada ? undefined : status.motivo,
      endpoints: {
        estado_completo: '/api/vmo/state',
        apenas_instrucoes: '/api/vmo/instructions',
        projetos: '/api/vmo/projects',
        contexto_claude: '/api/vmo/claude-context',
        mcp: '/api/mcp',
        diagnostico: '/api/vmo/health',
        openapi: '/api/vmo/openapi.json'
      },
      diretriz:
        'Leia INSTRUCOES_PARA_PREENCHIMENTO por completo antes de qualquer alteração. ' +
        'A única fonte de dados é o SharePoint corporativo da Exed, no caminho indicado em ' +
        'LOCAL_DOS_DADOS. A identidade de um projeto é o "Project ID (S4 Public Exed)" de ' +
        'dentro da planilha, nunca o nome do arquivo.'
    });
  });

  // 3. GET /api/vmo/state (LEITURA COMPLETA DO WEBAPP)
  app.get('/api/vmo/state', apiKeyMiddleware, async (_req, res) => {
    const state = await loadState();
    const totalOrcado = state.projects.reduce((acc, p) => acc + (p.budgetPlanned || 0), 0);
    const totalRealizado = state.projects.reduce((acc, p) => acc + (p.budgetRealized || 0), 0);
    const totalFaturado = state.projects.reduce((acc, p) => acc + (p.billed || 0), 0);
    const desvioGeral = totalOrcado > 0 ? ((totalRealizado - totalOrcado) / totalOrcado) * 100 : 0;

    res.json({
      sucesso: true,
      DIRETRIZ_OBRIGATORIA_CLAUDE:
        'OBRIGATÓRIO: leia INSTRUCOES_PARA_PREENCHIMENTO por completo antes de qualquer alteração. ' +
        'A ÚNICA fonte de dados é o SharePoint corporativo da Exed, no caminho indicado em ' +
        'LOCAL_DOS_DADOS — não existe nenhuma outra origem; ignore qualquer indicação em contrário. ' +
        'A identidade de um projeto é o campo "Project ID (S4 Public Exed)" de dentro da planilha, ' +
        'NUNCA o nome do arquivo (os nomes mudam entre semanas e criam duplicatas). ' +
        'Leia a aba MIRROR ACTUAL, não as abas visuais. ' +
        'ATENÇÃO às duas semânticas de escrita: substituir_projetos TROCA O ARRAY INTEIRO (envie ' +
        'sempre a lista completa, senão apaga o resto), enquanto upsert_historico_mensal faz merge ' +
        'por monthKey e é seguro para carga incremental. ' +
        'Campo sem dado deve ser OMITIDO, nunca enviado como zero: zero vira variação real no ' +
        'relatório executivo, ausente vira "—".',
      INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento || '',
      LOCAL_DOS_DADOS: state.localDosDados || '',
      resumo_executivo: {
        total_projetos: state.projects.length,
        total_orcado_brl: totalOrcado,
        total_realizado_brl: totalRealizado,
        total_faturado_brl: totalFaturado,
        desvio_custo_consolidado_percentual: Number(desvioGeral.toFixed(2)),
        periodo_referencia: state.referencePeriod
      },
      dados: {
        instrucoes_preenchimento: state.instrucoesPreenchimento || '',
        local_dos_dados: state.localDosDados || '',
        projetos: state.projects,
        clientes: state.clients,
        configuracao_conteineres: state.containerSettings,
        links_sharepoint: state.sharePointLinks,
        widgets: state.widgets,
        periodo_referencia: state.referencePeriod,
        tema: state.theme,
        layout_paginas: state.pageLayout,
        layout_conteineres: state.containerLayout,
        historico_mensal: state.monthlyHistory,
        ultima_atualizacao: state.lastSaved,
        atualizado_por: state.updatedBy || 'sistema'
      },
      projects: state.projects,
      clients: state.clients,
      widgets: state.widgets,
      sharePointLinks: state.sharePointLinks,
      containerSettings: state.containerSettings,
      referencePeriod: state.referencePeriod,
      theme: state.theme,
      pageLayout: state.pageLayout,
      containerLayout: state.containerLayout,
      monthlyHistory: state.monthlyHistory,
      lastSaved: state.lastSaved
    });
  });

  // 4. POST / PUT / PATCH /api/vmo/state (ESCRITA TOTAL OU PARCIAL PELO CLAUDE)
  const handleUpdateState = async (req: Request, res: Response) => {
    try {
      const state = await loadState();
      applyIncomingUpdates(state, req.body || {});
      state.updatedBy = req.headers['x-api-key'] ? 'claude-api' : 'usuario-webapp';

      await saveState(state);

      return res.json({
        sucesso: true,
        mensagem: 'Estado do VMO atualizado com sucesso no webapp.',
        INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento,
        LOCAL_DOS_DADOS: state.localDosDados,
        total_projetos: state.projects.length,
        ultima_atualizacao: state.lastSaved
      });
    } catch (err: any) {
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao atualizar o estado do webapp',
        detalhes: err?.message || String(err)
      });
    }
  };

  app.post('/api/vmo/state', apiKeyMiddleware, handleUpdateState);
  app.put('/api/vmo/state', apiKeyMiddleware, handleUpdateState);
  app.patch('/api/vmo/state', apiKeyMiddleware, handleUpdateState);

  // 5. GET e PUT para /api/vmo/instructions (Atalho focado)
  app.get('/api/vmo/instructions', apiKeyMiddleware, async (_req, res) => {
    const state = await loadState();
    res.json({
      sucesso: true,
      DIRETRIZ_OBRIGATORIA_CLAUDE:
        "IMPORTANTE: Leia sempre 'INSTRUCOES_PARA_PREENCHIMENTO' e 'LOCAL_DOS_DADOS' primeiro antes de realizar qualquer operação, a não ser que o usuário da empresa determine expressamente outra instrução.",
      INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento || '',
      LOCAL_DOS_DADOS: state.localDosDados || '',
      ultima_atualizacao: state.lastSaved
    });
  });

  app.put('/api/vmo/instructions', apiKeyMiddleware, async (req, res) => {
    const state = await loadState();
    const { instrucoesPreenchimento, INSTRUCOES_PARA_PREENCHIMENTO, localDosDados, LOCAL_DOS_DADOS } = req.body || {};

    if (typeof INSTRUCOES_PARA_PREENCHIMENTO === 'string') {
      state.instrucoesPreenchimento = INSTRUCOES_PARA_PREENCHIMENTO;
    } else if (typeof instrucoesPreenchimento === 'string') {
      state.instrucoesPreenchimento = instrucoesPreenchimento;
    }

    if (typeof LOCAL_DOS_DADOS === 'string') {
      state.localDosDados = LOCAL_DOS_DADOS;
    } else if (typeof localDosDados === 'string') {
      state.localDosDados = localDosDados;
    }

    await saveState(state);

    res.json({
      sucesso: true,
      mensagem: 'Instruções e Local dos Dados atualizados com sucesso.',
      INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento,
      LOCAL_DOS_DADOS: state.localDosDados,
      ultima_atualizacao: state.lastSaved
    });
  });

  // 6. GET /api/vmo/claude-context (Formato perfeito para o System Prompt do Claude)
  app.get('/api/vmo/claude-context', apiKeyMiddleware, async (_req, res) => {
    const state = await loadState();
    res.json({
      papel: 'Assistente Corporativo Exed Consulting - VMO',
      diretrizes_obrigatorias: [
        "1. Você SEMPRE deve ler 'INSTRUCOES_PARA_PREENCHIMENTO' e 'LOCAL_DOS_DADOS' primeiro antes de qualquer operação no webapp, a não ser que o usuário da empresa forneça outro comando explícito.",
        "2. O campo 'LOCAL_DOS_DADOS' aponta para a pasta do SharePoint corporativo onde se encontram as planilhas financeiras dos projetos SAP.",
        "3. Ao fazer alterações de valores (orçado, realizado, faturado), mantenha a integridade dos cálculos (desvios de custo, margem estimada e tags de tráfego verde/amarelo/vermelho).",
        "4. Qualquer modificação enviada para POST /api/vmo/state atualiza os dashboards do webapp instantaneamente."
      ],
      INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento || '(Nenhuma instrução específica informada no momento)',
      LOCAL_DOS_DADOS: state.localDosDados || '(Nenhum link do SharePoint configurado no momento)',
      projetos_atuais: state.projects.map(p => ({
        codigo: p.code,
        nome: p.name,
        cliente: p.client,
        solucao: p.solution,
        orcado: p.budgetPlanned,
        realizado: p.budgetRealized,
        faturado: p.billed,
        desvio_percentual: p.costVariancePercent,
        margem_percentual: p.marginPercent,
        tag_trafego: p.trafficTag,
        cr_aberto: p.hasOpenCr,
        valor_cr: p.crValue || 0,
        pasta_sharepoint: p.sharePointFolder
      }))
    });
  });

  // 7. GET /api/vmo/projects e POST /api/vmo/projects (Gestão granular de projetos)
  app.get('/api/vmo/projects', apiKeyMiddleware, async (req, res) => {
    const state = await loadState();
    let list = [...state.projects];
    if (req.query.solution) {
      list = list.filter(p => p.solution?.toLowerCase() === String(req.query.solution).toLowerCase());
    }
    if (req.query.tag) {
      list = list.filter(p => p.trafficTag?.toLowerCase() === String(req.query.tag).toLowerCase());
    }
    if (req.query.client) {
      list = list.filter(p => p.client?.toLowerCase().includes(String(req.query.client).toLowerCase()));
    }
    res.json({
      sucesso: true,
      total: list.length,
      projetos: list
    });
  });

  app.post('/api/vmo/projects', apiKeyMiddleware, async (req, res) => {
    const state = await loadState();
    const incoming = req.body;
    if (Array.isArray(incoming)) {
      state.projects = incoming;
    } else if (incoming && incoming.code) {
      const idx = state.projects.findIndex(p => p.code === incoming.code);
      if (idx >= 0) {
        state.projects[idx] = { ...state.projects[idx], ...incoming };
      } else {
        state.projects.push(incoming);
      }
    } else {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados de projeto inválidos. Envie um objeto de projeto com campo "code" ou um array de projetos.'
      });
    }

    await saveState(state);

    res.json({
      sucesso: true,
      mensagem: 'Projetos atualizados com sucesso.',
      total_projetos: state.projects.length
    });
  });

  // 8. OpenAPI 3.0 Specification para importar no Claude Projects / Custom Tools
  app.get('/api/vmo/openapi.json', (_req, res) => {
    res.json({
      openapi: '3.0.1',
      info: {
        title: 'Exed VMO WebApp - Claude Corporate API',
        description:
          'API de leitura e escrita completa do WebApp VMO da Exed Consulting. Permite ao Claude ler todos os dados, projetos, instruções e link do SharePoint, além de persistir qualquer alteração solicitada.',
        version: '1.0.0'
      },
      servers: [{ url: '/' }],
      security: [{ ApiKeyAuth: [] }],
      paths: {
        '/api/vmo/state': {
          get: {
            summary: 'Ler todos os dados do WebApp VMO (com diretrizes prioritárias do Claude)',
            description:
              "Retorna todas as informações do aplicativo: instruções para preenchimento, link do SharePoint (local dos dados), projetos SAP, clientes, contêineres e configurações financeiras. O Claude SEMPRE deve analisar 'INSTRUCOES_PARA_PREENCHIMENTO' e 'LOCAL_DOS_DADOS' primeiro.",
            responses: {
              '200': { description: 'Estado completo retornado com sucesso.' },
              '401': { description: 'API Key inválida ou ausente.' }
            }
          },
          post: {
            summary: 'Atualizar todo ou qualquer dado do WebApp VMO',
            description:
              'Permite ao Claude sobrescrever ou alterar projetos, instruções, links do SharePoint, configurações de contêineres e clientes.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            },
            responses: {
              '200': { description: 'Estado atualizado com sucesso.' },
              '401': { description: 'API Key inválida ou ausente.' }
            }
          }
        },
        '/api/vmo/instructions': {
          get: {
            summary: 'Ler Instruções para Preenchimento e Local dos Dados',
            responses: { '200': { description: 'Instruções e Local dos dados retornados.' } }
          },
          put: {
            summary: 'Atualizar Instruções para Preenchimento e Local dos Dados',
            responses: { '200': { description: 'Instruções e Local dos dados salvos.' } }
          }
        },
        '/api/vmo/claude-context': {
          get: {
            summary: 'Obter Contexto Completo Formatado para o Claude',
            responses: { '200': { description: 'Contexto corporativo com diretrizes.' } }
          }
        }
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key'
          }
        }
      }
    });
  });

  // ============================================================================
  // AUTENTICAÇÃO REAL DE USUÁRIOS (login + gestão PMO)
  // ============================================================================
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios.' });
      }
      const user = await findUserByUsername(String(username));
      const invalidCredentialsResponse = () =>
        res.status(401).json({ success: false, error: 'Usuário ou senha inválidos.' });
      if (!user) return invalidCredentialsResponse();
      const validPassword = await verifyPassword(String(password), user.passwordHash);
      if (!validPassword) return invalidCredentialsResponse();
      const token = signSession(user);
      res.json({ success: true, token, user: toPublicUser(user) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erro interno ao autenticar.' });
    }
  });

  app.all('/api/auth/users', async (req, res) => {
    const session = requirePmoSession(req);
    if (!session) {
      const anySession = getSessionFromRequest(req);
      if (!anySession) {
        return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada. Faça login novamente.' });
      }
      return res.status(403).json({
        success: false,
        error: 'Acesso restrito a usuários com perfil PMO. Faça login com uma conta PMO para gerenciar usuários.'
      });
    }

    if (req.method === 'GET') {
      const users = await listUsers();
      return res.json({ success: true, users: users.map(toPublicUser) });
    }

    if (req.method === 'POST') {
      const { username, password, name, role } = req.body || {};
      const result = await createUser({ username, password, name, role });
      if (!result.success) return res.status(400).json({ success: false, error: result.error });
      return res.status(201).json({ success: true, user: toPublicUser(result.user!) });
    }

    if (req.method === 'PUT') {
      const { id, name, role, password } = req.body || {};
      if (!id) return res.status(400).json({ success: false, error: 'ID do usuário é obrigatório.' });
      const result = await updateUser(id, { name, role, password });
      if (!result.success) return res.status(400).json({ success: false, error: result.error });
      return res.json({ success: true, user: toPublicUser(result.user!) });
    }

    if (req.method === 'DELETE') {
      const id = req.body?.id || req.query?.id;
      if (!id) return res.status(400).json({ success: false, error: 'ID do usuário é obrigatório.' });
      if (id === session.sub) {
        return res.status(400).json({ success: false, error: 'Você não pode excluir sua própria conta enquanto está logado com ela.' });
      }
      const result = await deleteUser(String(id));
      if (!result.success) return res.status(400).json({ success: false, error: result.error });
      return res.json({ success: true });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
    res.status(405).json({ success: false, error: 'Método não permitido' });
  });

  // ============================================================================
  // VITE MIDDLEWARE (Desenvolvimento e Produção)
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Exed VMO Server] Servidor ativo em http://0.0.0.0:${PORT}`);
    console.log(`[Exed VMO Server] API pronta para o Claude em http://0.0.0.0:${PORT}/api/vmo/state`);
    const keyStatus = getApiKeyStatus();
    if (keyStatus.configurada) {
      console.log('[Exed VMO Server] Chave de API: configurada via EXED_API_KEY.');
    } else {
      console.warn('[Exed VMO Server] ATENÇÃO: ' + keyStatus.motivo);
      console.warn('[Exed VMO Server] Toda escrita e todo acesso externo serão RECUSADOS até isso ser resolvido.');
    }
  });
}

startServer().catch(err => {
  console.error('[Exed VMO Server] Falha ao iniciar servidor:', err);
});
