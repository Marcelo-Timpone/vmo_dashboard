import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_PROJECTS,
  INITIAL_CLIENTS,
  INITIAL_WIDGETS,
  INITIAL_SHAREPOINT_LINKS,
  DEFAULT_CONTAINER_SETTINGS
} from './src/data/initialData';
import { calculateVmoReferencePeriod } from './src/utils/dateUtils';
import {
  SapProjectFinancial,
  ClientInfo,
  DashboardWidgetConfig,
  SharePointFolderLink,
  ContainerParamSettings,
  VmoReferencePeriod,
  AppTheme
} from './src/types';

// ==============================================================================
// CONFIGURAÇÕES DA API CORPORATIVA EXED PARA O CLAUDE
// ==============================================================================
const PORT = 3000;
const CORPORATE_DEFAULT_API_KEY = 'exed_claude_vmo_live_sec_key_2026';
const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'vmo_server_state.json');

// Interface do Estado do Servidor
interface ServerVmoState {
  instrucoesPreenchimento: string;
  localDosDados: string;
  projects: SapProjectFinancial[];
  clients: ClientInfo[];
  widgets: DashboardWidgetConfig[];
  sharePointLinks: SharePointFolderLink[];
  containerSettings: ContainerParamSettings;
  referencePeriod: VmoReferencePeriod;
  theme: AppTheme;
  lastSaved: string;
  updatedBy?: string;
}

export const DEFAULT_INSTRUCOES_PREENCHIMENTO = `Atualize os dados do dashboard com as informações presentes na URL do mês de referência. Se você não tem um mês específico que busca, verifique a data atual e encontre o dados desde o dia 02 do mês atual, até o presente momento. Caso seja o primeiro dia do mês atual, deve ser considerada a data referência desde o dia 02 do mês anterior.
Todas as informações necessárias estão no Link 2 e a última versão atualizada dos dados está no link 1.
Realize o fluxo: 
(1) Acesse o link 2, acesse o mês de referência, acesse a primeira pasta em ordem alfabética, acesse as pastas Dashboard - GROW + DSC e Dashboard - RISE + FSW, leia todas as planilhas dentro de cada uma dessas pastas. 
(2) Repita esse fluxo até ler todas as pastas dentro do mês de referência.
(3) Atualize as informações do webapp de acordo com as leituras de todos os documentos.`;

// Inicializador do Estado em Disco / Memória
function getInitialState(): ServerVmoState {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.projects)) {
        return {
          ...parsed,
          sharePointLinks: INITIAL_SHAREPOINT_LINKS,
          instrucoesPreenchimento: parsed.instrucoesPreenchimento || DEFAULT_INSTRUCOES_PREENCHIMENTO
        };
      }
    }
  } catch (err) {
    console.warn('Não foi possível ler o arquivo de dados persistidos, usando dados padrão:', err);
  }

  const defaultState: ServerVmoState = {
    instrucoesPreenchimento: DEFAULT_INSTRUCOES_PREENCHIMENTO,
    localDosDados: '',
    projects: INITIAL_PROJECTS,
    clients: INITIAL_CLIENTS,
    widgets: INITIAL_WIDGETS,
    sharePointLinks: INITIAL_SHAREPOINT_LINKS,
    containerSettings: DEFAULT_CONTAINER_SETTINGS,
    referencePeriod: calculateVmoReferencePeriod(new Date()),
    theme: 'neon',
    lastSaved: new Date().toISOString(),
    updatedBy: 'sistema-inicial'
  };

  saveStateToDisk(defaultState);
  return defaultState;
}

function saveStateToDisk(state: ServerVmoState) {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao persistir vmo_server_state.json no disco:', err);
  }
}

let vmoState: ServerVmoState = getInitialState();

// ==============================================================================
// INICIALIZAÇÃO DO SERVIDOR EXPRESS COM VITE MIDDLEWARE
// ==============================================================================
async function startServer() {
  const app = express();

  // CORS headers para permitir chamadas do Claude / MCP / agentes corporativos
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, X-API-Key'
    );
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
    // Rotas públicas de status e documentação
    if (
      req.path === '/api/vmo/health' ||
      req.path === '/api/vmo/openapi.json' ||
      req.path === '/api/vmo/key-info'
    ) {
      return next();
    }

    const configuredKey = (process.env.EXED_API_KEY || CORPORATE_DEFAULT_API_KEY).trim();
    
    // Extração do cabeçalho
    const headerKey = (req.headers['x-api-key'] || req.headers['X-API-Key'] || req.headers['x-api-key'.toLowerCase()]) as string | undefined;
    const authHeader = req.headers['authorization'] as string | undefined;
    const queryKey = req.query.apiKey as string | undefined;

    let providedKey = '';
    if (headerKey && typeof headerKey === 'string') {
      providedKey = headerKey.trim();
    } else if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      providedKey = authHeader.substring(7).trim();
    } else if (queryKey && typeof queryKey === 'string') {
      providedKey = queryKey.trim();
    }

    // Permitir requisições GET internas originadas do próprio frontend local
    const referer = (req.headers['referer'] || '') as string;
    const host = (req.headers['host'] || '') as string;
    const isSameOriginGet = req.method === 'GET' && host && referer.includes(host);

    if (providedKey === configuredKey || isSameOriginGet) {
      return next();
    }

    return res.status(401).json({
      sucesso: false,
      erro: 'Acesso Não Autorizado',
      mensagem:
        "API Key corporativa inválida ou ausente. Forneça o cabeçalho 'x-api-key: <CHAVE>' ou 'Authorization: Bearer <CHAVE>'.",
      chave_padrao_sugerida: CORPORATE_DEFAULT_API_KEY,
      documentacao: '/api/vmo/openapi.json'
    });
  };

  // ============================================================================
  // ROTAS DA API CORPORATIVA EXED PARA O CLAUDE
  // ============================================================================

  // 1. Health & Status
  app.get('/api/vmo/health', (_req, res) => {
    res.json({
      status: 'online',
      projeto: 'Exed Consulting - VMO Corporativo',
      versao_api: '1.0-claude-ready',
      timestamp: new Date().toISOString(),
      autenticacao: 'API Key (x-api-key ou Bearer)',
      projetos_cadastrados: vmoState.projects.length,
      sharepoint_configurado: !!vmoState.localDosDados
    });
  });

  // 2. Info da chave e endpoints (para exibição no webapp)
  app.get('/api/vmo/key-info', (_req, res) => {
    const activeKey = (process.env.EXED_API_KEY || CORPORATE_DEFAULT_API_KEY).trim();
    res.json({
      sucesso: true,
      apiKey: activeKey,
      endpoints: {
        estado_completo: '/api/vmo/state',
        apenas_instrucoes: '/api/vmo/instructions',
        projetos: '/api/vmo/projects',
        contexto_claude: '/api/vmo/claude-context',
        openapi: '/api/vmo/openapi.json'
      },
      diretriz:
        "O Claude deve ler primeiramente 'INSTRUCOES_PARA_PREENCHIMENTO' e o Link 1 (Histórico de versões do webapp em JASON) antes de qualquer alteração. A última versão dos dados do webapp está no Link 1 e é identificada pela data no nome do arquivo (ANO, MÊS, DIA). Todas as informações necessárias estão no Link 2."
    });
  });

  // 3. GET /api/vmo/state (LEITURA COMPLETA DO WEBAPP)
  // O Claude lê tudo o que existe no webapp com destaque obrigatório para as instruções e local dos dados
  app.get('/api/vmo/state', apiKeyMiddleware, (_req, res) => {
    const totalOrcado = vmoState.projects.reduce((acc, p) => acc + (p.budgetPlanned || 0), 0);
    const totalRealizado = vmoState.projects.reduce((acc, p) => acc + (p.budgetRealized || 0), 0);
    const totalFaturado = vmoState.projects.reduce((acc, p) => acc + (p.billed || 0), 0);
    const desvioGeral = totalOrcado > 0 ? ((totalRealizado - totalOrcado) / totalOrcado) * 100 : 0;

    res.json({
      sucesso: true,
      DIRETRIZ_OBRIGATORIA_CLAUDE:
        "IMPORTANTE: Leia sempre 'INSTRUCOES_PARA_PREENCHIMENTO' e o Link 1 (Histórico de versões do webapp em JASON) primeiro antes de qualquer alteração. A última versão dos dados do webapp está no Link 1, identificável pelo padrão de data ANO, MÊS, DIA no nome do arquivo. Todas as informações necessárias estão no Link 2 e na pasta do mês de referência.",
      INSTRUCOES_PARA_PREENCHIMENTO: vmoState.instrucoesPreenchimento || '',
      LOCAL_DOS_DADOS: vmoState.localDosDados || '',
      resumo_executivo: {
        total_projetos: vmoState.projects.length,
        total_orcado_brl: totalOrcado,
        total_realizado_brl: totalRealizado,
        total_faturado_brl: totalFaturado,
        desvio_custo_consolidado_percentual: Number(desvioGeral.toFixed(2)),
        periodo_referencia: vmoState.referencePeriod
      },
      dados: {
        instrucoes_preenchimento: vmoState.instrucoesPreenchimento || '',
        local_dos_dados: vmoState.localDosDados || '',
        projetos: vmoState.projects,
        clientes: vmoState.clients,
        configuracao_conteineres: vmoState.containerSettings,
        links_sharepoint: vmoState.sharePointLinks,
        widgets: vmoState.widgets,
        periodo_referencia: vmoState.referencePeriod,
        tema: vmoState.theme,
        ultima_atualizacao: vmoState.lastSaved,
        atualizado_por: vmoState.updatedBy || 'sistema'
      },
      // Compatibilidade direta com nomes em inglês
      projects: vmoState.projects,
      clients: vmoState.clients,
      widgets: vmoState.widgets,
      sharePointLinks: vmoState.sharePointLinks,
      containerSettings: vmoState.containerSettings,
      referencePeriod: vmoState.referencePeriod,
      theme: vmoState.theme,
      lastSaved: vmoState.lastSaved
    });
  });

  // 4. POST / PUT /api/vmo/state (ESCRITA TOTAL OU PARCIAL PELO CLAUDE)
  const handleUpdateState = (req: Request, res: Response) => {
    try {
      const body = req.body || {};

      // 1. Atualizar Instruções para Preenchimento se fornecido
      if (typeof body.INSTRUCOES_PARA_PREENCHIMENTO === 'string') {
        vmoState.instrucoesPreenchimento = body.INSTRUCOES_PARA_PREENCHIMENTO;
      } else if (typeof body.instrucoesPreenchimento === 'string') {
        vmoState.instrucoesPreenchimento = body.instrucoesPreenchimento;
      } else if (typeof body.instrucoes_preenchimento === 'string') {
        vmoState.instrucoesPreenchimento = body.instrucoes_preenchimento;
      }

      // 2. Atualizar Local dos Dados (SharePoint) se fornecido
      if (typeof body.LOCAL_DOS_DADOS === 'string') {
        vmoState.localDosDados = body.LOCAL_DOS_DADOS;
      } else if (typeof body.localDosDados === 'string') {
        vmoState.localDosDados = body.localDosDados;
      } else if (typeof body.local_dos_dados === 'string') {
        vmoState.localDosDados = body.local_dos_dados;
      }

      // 3. Atualizar Projetos se fornecido
      const incomingProjects = body.projects || body.projetos || body.dados?.projetos;
      if (Array.isArray(incomingProjects)) {
        vmoState.projects = incomingProjects;
      }

      // 4. Atualizar Clientes se fornecido
      const incomingClients = body.clients || body.clientes || body.dados?.clientes;
      if (Array.isArray(incomingClients)) {
        vmoState.clients = incomingClients;
      }

      // 5. Atualizar Configurações de Contêineres se fornecido
      const incomingContainers = body.containerSettings || body.configuracao_conteineres || body.dados?.configuracao_conteineres;
      if (incomingContainers && typeof incomingContainers === 'object') {
        vmoState.containerSettings = {
          ...vmoState.containerSettings,
          ...incomingContainers
        };
      }

      // 6. Atualizar Links do SharePoint se fornecido
      const incomingLinks = body.sharePointLinks || body.links_sharepoint || body.dados?.links_sharepoint;
      if (Array.isArray(incomingLinks)) {
        vmoState.sharePointLinks = incomingLinks;
      }

      // 7. Atualizar Widgets se fornecido
      const incomingWidgets = body.widgets || body.dados?.widgets;
      if (Array.isArray(incomingWidgets)) {
        vmoState.widgets = incomingWidgets;
      }

      // 8. Atualizar Período de Referência se fornecido
      const incomingPeriod = body.referencePeriod || body.periodo_referencia || body.dados?.periodo_referencia;
      if (incomingPeriod && typeof incomingPeriod === 'object') {
        vmoState.referencePeriod = {
          ...vmoState.referencePeriod,
          ...incomingPeriod
        };
      }

      // 9. Atualizar Tema se fornecido
      if (body.theme || body.tema) {
        vmoState.theme = body.theme || body.tema;
      }

      vmoState.lastSaved = new Date().toISOString();
      vmoState.updatedBy = (req.headers['x-api-key'] ? 'claude-api' : 'usuario-webapp');

      saveStateToDisk(vmoState);

      return res.json({
        sucesso: true,
        mensagem: 'Estado do VMO atualizado com sucesso no webapp.',
        INSTRUCOES_PARA_PREENCHIMENTO: vmoState.instrucoesPreenchimento,
        LOCAL_DOS_DADOS: vmoState.localDosDados,
        total_projetos: vmoState.projects.length,
        ultima_atualizacao: vmoState.lastSaved
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
  app.get('/api/vmo/instructions', apiKeyMiddleware, (_req, res) => {
    res.json({
      sucesso: true,
      DIRETRIZ_OBRIGATORIA_CLAUDE:
        "IMPORTANTE: Leia sempre 'INSTRUCOES_PARA_PREENCHIMENTO' e 'LOCAL_DOS_DADOS' primeiro antes de realizar qualquer operação, a não ser que o usuário da empresa determine expressamente outra instrução.",
      INSTRUCOES_PARA_PREENCHIMENTO: vmoState.instrucoesPreenchimento || '',
      LOCAL_DOS_DADOS: vmoState.localDosDados || '',
      ultima_atualizacao: vmoState.lastSaved
    });
  });

  app.put('/api/vmo/instructions', apiKeyMiddleware, (req, res) => {
    const { instrucoesPreenchimento, INSTRUCOES_PARA_PREENCHIMENTO, localDosDados, LOCAL_DOS_DADOS } = req.body || {};
    if (typeof INSTRUCOES_PARA_PREENCHIMENTO === 'string') {
      vmoState.instrucoesPreenchimento = INSTRUCOES_PARA_PREENCHIMENTO;
    } else if (typeof instrucoesPreenchimento === 'string') {
      vmoState.instrucoesPreenchimento = instrucoesPreenchimento;
    }

    if (typeof LOCAL_DOS_DADOS === 'string') {
      vmoState.localDosDados = LOCAL_DOS_DADOS;
    } else if (typeof localDosDados === 'string') {
      vmoState.localDosDados = localDosDados;
    }

    vmoState.lastSaved = new Date().toISOString();
    saveStateToDisk(vmoState);

    res.json({
      sucesso: true,
      mensagem: 'Instruções e Local dos Dados atualizados com sucesso.',
      INSTRUCOES_PARA_PREENCHIMENTO: vmoState.instrucoesPreenchimento,
      LOCAL_DOS_DADOS: vmoState.localDosDados,
      ultima_atualizacao: vmoState.lastSaved
    });
  });

  // 6. GET /api/vmo/claude-context (Formato perfeito para o System Prompt do Claude)
  app.get('/api/vmo/claude-context', apiKeyMiddleware, (_req, res) => {
    res.json({
      papel: 'Assistente Corporativo Exed Consulting - VMO',
      diretrizes_obrigatorias: [
        "1. Você SEMPRE deve ler 'INSTRUCOES_PARA_PREENCHIMENTO' e 'LOCAL_DOS_DADOS' primeiro antes de qualquer operação no webapp, a não ser que o usuário da empresa forneça outro comando explícito.",
        "2. O campo 'LOCAL_DOS_DADOS' aponta para a pasta do SharePoint corporativo onde se encontram as planilhas financeiras dos projetos SAP.",
        "3. Ao fazer alterações de valores (orçado, realizado, faturado), mantenha a integridade dos cálculos (desvios de custo, margem estimada e tags de tráfego verde/amarelo/vermelho).",
        "4. Qualquer modificação enviada para POST /api/vmo/state atualiza os dashboards do webapp instantaneamente."
      ],
      INSTRUCOES_PARA_PREENCHIMENTO: vmoState.instrucoesPreenchimento || '(Nenhuma instrução específica informada no momento)',
      LOCAL_DOS_DADOS: vmoState.localDosDados || '(Nenhum link do SharePoint configurado no momento)',
      projetos_atuais: vmoState.projects.map(p => ({
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
  app.get('/api/vmo/projects', apiKeyMiddleware, (req, res) => {
    let list = [...vmoState.projects];
    if (req.query.solution) {
      list = list.filter(p => p.solution.toLowerCase() === String(req.query.solution).toLowerCase());
    }
    if (req.query.tag) {
      list = list.filter(p => p.trafficTag.toLowerCase() === String(req.query.tag).toLowerCase());
    }
    if (req.query.client) {
      list = list.filter(p => p.client.toLowerCase().includes(String(req.query.client).toLowerCase()));
    }
    res.json({
      sucesso: true,
      total: list.length,
      projetos: list
    });
  });

  app.post('/api/vmo/projects', apiKeyMiddleware, (req, res) => {
    const incoming = req.body;
    if (Array.isArray(incoming)) {
      vmoState.projects = incoming;
    } else if (incoming && incoming.code) {
      const idx = vmoState.projects.findIndex(p => p.code === incoming.code);
      if (idx >= 0) {
        vmoState.projects[idx] = { ...vmoState.projects[idx], ...incoming };
      } else {
        vmoState.projects.push(incoming);
      }
    } else {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados de projeto inválidos. Envie um objeto de projeto com campo "code" ou um array de projetos.'
      });
    }

    vmoState.lastSaved = new Date().toISOString();
    saveStateToDisk(vmoState);

    res.json({
      sucesso: true,
      mensagem: 'Projetos atualizados com sucesso.',
      total_projetos: vmoState.projects.length
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
  });
}

startServer().catch(err => {
  console.error('[Exed VMO Server] Falha ao iniciar servidor:', err);
});
