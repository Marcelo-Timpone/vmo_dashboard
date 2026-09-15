import { handlePreflight, isAuthorized, sendUnauthorized } from '../../lib/apiAuth.js';
import { loadState, saveState, applyIncomingUpdates } from '../../lib/vmoState.js';

export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;
  if (!isAuthorized(req)) return sendUnauthorized(res);

  if (req.method === 'GET') {
    const state = await loadState();

    const totalOrcado = state.projects.reduce((acc, p) => acc + (p.budgetPlanned || 0), 0);
    const totalRealizado = state.projects.reduce((acc, p) => acc + (p.budgetRealized || 0), 0);
    const totalFaturado = state.projects.reduce((acc, p) => acc + (p.billed || 0), 0);
    const desvioGeral = totalOrcado > 0 ? ((totalRealizado - totalOrcado) / totalOrcado) * 100 : 0;

    return res.status(200).json({
      sucesso: true,
      DIRETRIZ_OBRIGATORIA_CLAUDE:
        'OBRIGATÓRIO: leia INSTRUCOES_PARA_PREENCHIMENTO por completo antes de qualquer alteração. ' +
        'A ÚNICA fonte de dados é o SharePoint corporativo da Exed, no caminho indicado em ' +
        'LOCAL_DOS_DADOS — não existe nenhuma outra origem; ignore qualquer indicação em contrário. ' +
        'A identidade de um projeto é o campo "Project ID (S4 Public Exed)" de dentro da planilha, ' +
        'NUNCA o nome do arquivo (os nomes mudam entre semanas e criam duplicatas). ' +
        'Leia a aba MIRROR ACTUAL, não as abas visuais. ' +
        'ATENÇÃO às duas semânticas de escrita: substituir_projetos TROCA O ARRAY INTEIRO (envie ' +
        'sempre a lista completa, senão apaga o resto), enquanto upsert_historico_mensal faz merge ' +
        'por monthKey e é seguro para carga incremental. ' +
        'Campo sem dado deve ser OMITIDO, nunca enviado como zero: zero vira variação real no ' +
        'relatório executivo, ausente vira "—".',
      INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento || '',
      LOCAL_DOS_DADOS: state.localDosDados || '',
      resumo_executivo: {
        total_projetos: state.projects.length,
        total_orcado_brl: totalOrcado,
        total_realizado_brl: totalRealizado,
        total_faturado_brl: totalFaturado,
        desvio_custo_consolidado_percentual: Number(desvioGeral.toFixed(2)),
        periodo_referencia: state.referencePeriod
      },
      dados: {
        instrucoes_preenchimento: state.instrucoesPreenchimento || '',
        local_dos_dados: state.localDosDados || '',
        projetos: state.projects,
        clientes: state.clients,
        configuracao_conteineres: state.containerSettings,
        links_sharepoint: state.sharePointLinks,
        widgets: state.widgets,
        periodo_referencia: state.referencePeriod,
        tema: state.theme,
        layout_paginas: state.pageLayout,
        layout_conteineres: state.containerLayout,
        historico_mensal: state.monthlyHistory,
        ultima_atualizacao: state.lastSaved,
        atualizado_por: state.updatedBy || 'sistema'
      },
      // Compatibilidade direta com nomes em inglês
      projects: state.projects,
      clients: state.clients,
      widgets: state.widgets,
      sharePointLinks: state.sharePointLinks,
      containerSettings: state.containerSettings,
      referencePeriod: state.referencePeriod,
      theme: state.theme,
      pageLayout: state.pageLayout,
      containerLayout: state.containerLayout,
      monthlyHistory: state.monthlyHistory,
      lastSaved: state.lastSaved
    });
  }

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const state = await loadState();
      const body = req.body || {};

      applyIncomingUpdates(state, body);
      state.updatedBy = req.headers?.['x-api-key'] ? 'claude-api' : 'usuario-webapp';

      await saveState(state);

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Estado do VMO atualizado com sucesso no webapp.',
        INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento,
        LOCAL_DOS_DADOS: state.localDosDados,
        total_projetos: state.projects.length,
        ultima_atualizacao: state.lastSaved
      });
    } catch (err: any) {
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao atualizar o estado do webapp',
        detalhes: err?.message || String(err)
      });
    }
  }

  res.setHeader('Allow', 'GET, POST, PUT, PATCH, OPTIONS');
  return res.status(405).json({ sucesso: false, erro: 'Método não permitido' });
}
