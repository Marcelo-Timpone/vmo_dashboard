// ==============================================================================
// AUTENTICAÇÃO POR API KEY + CORS — COMPARTILHADO ENTRE:
//  - server.ts (Express, usado em desenvolvimento local via `npm run dev`)
//  - /api/vmo/*.ts (Vercel Serverless Functions, usado em produção)
// ==============================================================================
// Os tipos de req/res são deixados como `any` de propósito: tanto o Request/
// Response do Express quanto o request/response das funções da Vercel têm o
// mesmo formato prático (headers, method, query, body, status(), json()),
// então a mesma lógica funciona nos dois ambientes sem depender de pacotes
// extras de tipos (@types/express já cobre o uso local).

export const CORPORATE_DEFAULT_API_KEY = 'exed_claude_vmo_live_sec_key_2026';

export function getConfiguredApiKey(): string {
  return (process.env.EXED_API_KEY || CORPORATE_DEFAULT_API_KEY).trim();
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
 * GETs feitos pelo próprio frontend (mesma origem) continuam liberados sem
 * chave, exatamente como no server.ts original — apenas escrita e acesso
 * externo (ex: o Claude) exigem a API key.
 */
export function isAuthorized(req: any): boolean {
  const configuredKey = getConfiguredApiKey();
  const providedKey = extractProvidedKey(req);

  const referer = String(req.headers?.['referer'] ?? req.headers?.['referrer'] ?? '');
  const host = String(req.headers?.['host'] ?? '');
  const isSameOriginGet = req.method === 'GET' && Boolean(host) && referer.includes(host);

  return providedKey === configuredKey || isSameOriginGet;
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
  res.status(401).json({
    sucesso: false,
    erro: 'Acesso Não Autorizado',
    mensagem:
      "API Key corporativa inválida ou ausente. Forneça o cabeçalho 'x-api-key: <CHAVE>' ou 'Authorization: Bearer <CHAVE>'.",
    chave_padrao_sugerida: CORPORATE_DEFAULT_API_KEY,
    documentacao: '/api/vmo/openapi.json'
  });
}
