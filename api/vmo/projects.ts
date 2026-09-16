import { handlePreflight, isAuthorized, sendUnauthorized } from '../../lib/apiAuth.js';
import { loadState, saveState } from '../../lib/vmoState.js';
import { normalizarFrente, normalizarSolucao } from '../../src/utils/portfolio.js';

export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;
  if (!isAuthorized(req)) return sendUnauthorized(res);

  if (req.method === 'GET') {
    const state = await loadState();
    let list = [...state.projects];

    if (req.query?.front) {
      const frente = normalizarFrente(String(req.query.front));
      list = list.filter(p => p.front === frente);
    }
    if (req.query?.solution) {
      const solucao = normalizarSolucao(String(req.query.solution));
      list = list.filter(p => normalizarSolucao(p.solution) === solucao);
    }
    if (req.query?.tag) {
      list = list.filter(p => p.trafficTag?.toLowerCase() === String(req.query.tag).toLowerCase());
    }
    if (req.query?.client) {
      list = list.filter(p => p.client?.toLowerCase().includes(String(req.query.client).toLowerCase()));
    }

    return res.status(200).json({ sucesso: true, total: list.length, projetos: list });
  }

  if (req.method === 'POST') {
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

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Projetos atualizados com sucesso.',
      total_projetos: state.projects.length
    });
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ sucesso: false, erro: 'Método não permitido' });
}
