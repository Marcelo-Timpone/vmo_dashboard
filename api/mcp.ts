// ==============================================================================
// ENDPOINT MCP NA VERCEL — https://<dominio>/api/mcp
// ==============================================================================
// É esta a URL que deve ser cadastrada como conector no Claude (e não
// /api/vmo/state, que é REST e por isso nunca expõe ferramenta nenhuma).
//
// Como a interface de conector personalizado do Claude não tem campo para
// cabeçalho customizado, a forma prática de autenticar é pela query string:
//
//   https://vmodashboard.vercel.app/api/mcp?apiKey=SUA_CHAVE
//
// Os cabeçalhos 'x-api-key' e 'Authorization: Bearer' também continuam
// funcionando, para clientes que saibam enviá-los.
// ==============================================================================

import { handleMcpRequest } from '../lib/mcpServer.js';

export default async function handler(req: any, res: any) {
  return handleMcpRequest(req, res);
}
