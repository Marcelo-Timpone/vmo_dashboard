import { handlePreflight, getConfiguredApiKey } from '../../lib/apiAuth';

// Rota pública (sem API key) — só existe para o próprio webapp exibir a
// chave/endpoints configurados na tela de Configuração.
export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;

  res.status(200).json({
    sucesso: true,
    apiKey: getConfiguredApiKey(),
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
}
