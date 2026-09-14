import { handlePreflight } from '../../lib/apiAuth.js';

// Rota pública (sem API key) — descrição OpenAPI 3.0 da API, para importar em
// Claude Projects / Custom Connectors / ferramentas de terceiros.
// Exposta em /api/vmo/openapi.json através de um rewrite no vercel.json.
export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;

  res.status(200).json({
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
            content: { 'application/json': { schema: { type: 'object' } } }
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
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' }
      }
    }
  });
}
