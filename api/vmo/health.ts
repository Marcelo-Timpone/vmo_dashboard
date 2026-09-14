import { handlePreflight } from '../../lib/apiAuth.js';
import { loadState } from '../../lib/vmoState.js';

// Rota pública (sem API key) — usada para checar se a API está no ar.
export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;

  const state = await loadState();

  res.status(200).json({
    status: 'online',
    projeto: 'Exed Consulting - VMO Corporativo',
    versao_api: '1.0-claude-ready',
    timestamp: new Date().toISOString(),
    autenticacao: 'API Key (x-api-key ou Bearer)',
    projetos_cadastrados: state.projects.length,
    sharepoint_configurado: !!state.localDosDados
  });
}
