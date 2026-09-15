// ==============================================================================
// AUTENTICAÇÃO POR API KEY + CORS — COMPARTILHADO ENTRE:
//  - server.ts (Express, usado em desenvolvimento local via `npm run dev`)
//  - /api/vmo/*.ts e /api/mcp.ts (Vercel Serverless Functions, produção)
// ==============================================================================
// Os tipos de req/res são deixados como `any` de propósito: tanto o Request/
// Response do Express quanto o request/response das funções da Vercel têm o
// mesmo formato prático (headers, method, query, body, status(), json()),
// então a mesma lógica funciona nos dois ambientes sem depender de pacotes
// extras de tipos (@types/express já cobre o uso local).
//
// ------------------------------------------------------------------------------
// MUDANÇA DE POSTURA DE SEGURANÇA (falha fechada)
// ------------------------------------------------------------------------------
// Antes existia aqui uma constante `CORPORATE_DEFAULT_API_KEY` com a chave de
// produção em texto puro. Quem tivesse acesso ao repositório tinha a chave, e um
// deploy sem EXED_API_KEY configurada continuava aceitando essa chave conhecida.
//
// Agora a chave vem EXCLUSIVAMENTE de process.env.EXED_API_KEY. Sem essa
// variável, nenhuma requisição autenticada é aceita — o deploy falha FECHADO,
// em vez de abrir acesso a todos os dados financeiros.
//
// >>> Para o conector do Claude voltar a funcionar, configure na Vercel:
// >>>   Settings > Environment Variables > EXED_API_KEY = <sua chave>
// >>> e faça um novo deploy. O passo a passo está em CONECTOR-MCP.md.
// ==============================================================================

/** Tamanho mínimo aceito para a chave, para barrar valores de teste ("123"). */
const MIN_API_KEY_LENGTH = 16;

export function getConfiguredApiKey(): string {
  return (process.env.EXED_API_KEY || '').trim();
}

/**
 * Diagnóstico da configuração de autenticação. Usado por /api/vmo/health para
 * dizer exatamente o que falta, em vez de devolver só um 401 silencioso.
 */
export function getApiKeyStatus(): { configurada: boolean; motivo?: string } {
  const key = getConfiguredApiKey();
  if (!key) {
    return {
      configurada: false,
      motivo:
        'A variável de ambiente EXED_API_KEY não está definida. Configure-a na Vercel ' +
        '(Settings > Environment Variables) e refaça o deploy. Sem ela, toda escrita e ' +
        'todo acesso externo são recusados.'
    };
  }
  if (key.length < MIN_API_KEY_LENGTH) {
    return {
      configurada: false,
      motivo: `EXED_API_KEY está definida, mas é curta demais (mínimo de ${MIN_API_KEY_LENGTH} caracteres).`
    };
  }
  return { configurada: true };
}

export function extractProvidedKey(req: any): string {
  const headerKey = req.headers?.['x-api-key'] ?? req.headers?.['X-API-Key'];
  const authHeader = req.headers?.['authorization'] ?? req.headers?.['Authorization'];
  const queryKey = req.query?.apiKey;

  if (typeof headerKey === 'string' && headerKey.trim()) return headerKey.trim();
  if (Array.isArray(headerKey) && headerKey[0]) return String(headerKey[0]).trim();

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  if (typeof queryKey === 'string' && queryKey.trim()) return queryKey.trim();

  return '';
}

/**
 * Comparação em tempo constante, para não vazar o tamanho/prefixo da chave por
 * diferença de tempo de resposta.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * GETs feitos pelo próprio frontend (mesma origem) continuam liberados sem
 * chave — é assim que o dashboard carrega os dados sem embutir a chave no
 * navegador.
 *
 * ATENÇÃO, DÍVIDA DE SEGURANÇA CONHECIDA: o cabeçalho `referer` é controlado
 * pelo cliente e pode ser forjado, então na prática qualquer pessoa consegue
 * fazer um GET dos dados financeiros. Isso já era assim antes desta alteração e
 * foi mantido para não quebrar o carregamento do dashboard. O caminho correto é
 * trocar por sessão autenticada (o JWT do login já existe em lib/auth.ts) e
 * então remover esta exceção. Escrita (POST/PUT/PATCH) nunca dependeu disto.
 */
export function isAuthorized(req: any): boolean {
  const configuredKey = getConfiguredApiKey();
  const providedKey = extractProvidedKey(req);

  const referer = String(req.headers?.['referer'] ?? req.headers?.['referrer'] ?? '');
  const host = String(req.headers?.['host'] ?? '');
  const isSameOriginGet = req.method === 'GET' && Boolean(host) && referer.includes(host);

  if (isSameOriginGet) return true;

  // Sem chave configurada no ambiente, nada externo é aceito (falha fechada).
  if (!getApiKeyStatus().configurada) return false;

  return Boolean(providedKey) && safeEqual(providedKey, configuredKey);
}

export function setCorsHeaders(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, X-API-Key'
  );
}

/**
 * Aplica CORS e responde a requisições OPTIONS (preflight).
 * Retorna `true` se a requisição já foi finalizada (era um OPTIONS).
 */
export function handlePreflight(req: any, res: any): boolean {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export function sendUnauthorized(res: any): void {
  const status = getApiKeyStatus();

  // A resposta NUNCA devolve a chave esperada — a versão anterior sugeria a
  // chave padrão no corpo do 401, o que entregava a credencial a qualquer um
  // que fizesse uma requisição sem autenticação.
  res.status(401).json({
    sucesso: false,
    erro: 'Acesso Não Autorizado',
    mensagem: status.configurada
      ? "API Key inválida ou ausente. Forneça o cabeçalho 'x-api-key: <CHAVE>' ou 'Authorization: Bearer <CHAVE>'."
      : 'A API está sem chave configurada no servidor e por isso recusa todas as requisições autenticadas.',
    configuracao_pendente: status.configurada ? undefined : status.motivo,
    documentacao: '/api/vmo/openapi.json'
  });
}
