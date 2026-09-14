import { handlePreflight, isAuthorized, sendUnauthorized } from '../../lib/apiAuth';
import { loadState, saveState } from '../../lib/vmoState';

export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;
  if (!isAuthorized(req)) return sendUnauthorized(res);

  if (req.method === 'GET') {
    const state = await loadState();
    return res.status(200).json({
      sucesso: true,
      DIRETRIZ_OBRIGATORIA_CLAUDE:
        "IMPORTANTE: Leia sempre 'INSTRUCOES_PARA_PREENCHIMENTO' e 'LOCAL_DOS_DADOS' primeiro antes de realizar qualquer operação, a não ser que o usuário da empresa determine expressamente outra instrução.",
      INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento || '',
      LOCAL_DOS_DADOS: state.localDosDados || '',
      ultima_atualizacao: state.lastSaved
    });
  }

  if (req.method === 'PUT') {
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

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Instruções e Local dos Dados atualizados com sucesso.',
      INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento,
      LOCAL_DOS_DADOS: state.localDosDados,
      ultima_atualizacao: state.lastSaved
    });
  }

  res.setHeader('Allow', 'GET, PUT, OPTIONS');
  return res.status(405).json({ sucesso: false, erro: 'Método não permitido' });
}
