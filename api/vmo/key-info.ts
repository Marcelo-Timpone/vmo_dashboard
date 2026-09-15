import { handlePreflight, getApiKeyStatus } from '../../lib/apiAuth.js';

// ==============================================================================
// ROTA PÚBLICA — /api/vmo/key-info
// ==============================================================================
// ATENÇÃO, FALHA CORRIGIDA AQUI: esta rota é PÚBLICA (não exige autenticação) e
// devolvia `apiKey: getConfiguredApiKey()` — ou seja, qualquer pessoa na
// internet podia fazer um GET e receber a chave de produção, que dá acesso de
// escrita a todos os dados financeiros. Isso anulava por completo qualquer
// proteção por API key.
//
// A rota agora devolve APENAS a lista de endpoints e se a chave está
// configurada — nunca o valor dela. O PMO cadastra a própria chave na tela de
// Configurações, e ela fica no localStorage daquele navegador.
//
// REGRA: nenhuma rota pública deste projeto pode devolver credenciais.
// ==============================================================================
export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;

  const status = getApiKeyStatus();

  res.status(200).json({
    sucesso: true,
    chave_configurada: status.configurada,
    // Deliberadamente NÃO devolvemos o valor da chave.
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
      'LOCAL_DOS_DADOS. A identidade de um projeto é o "Project ID (S4 Public Exed)" de dentro ' +
      'da planilha, nunca o nome do arquivo.'
  });
}
