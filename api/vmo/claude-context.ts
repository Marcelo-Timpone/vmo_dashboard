import { handlePreflight, isAuthorized, sendUnauthorized } from '../../lib/apiAuth.js';
import { loadState } from '../../lib/vmoState.js';

export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;
  if (!isAuthorized(req)) return sendUnauthorized(res);

  const state = await loadState();

  res.status(200).json({
    papel: 'Assistente Corporativo Exed Consulting - VMO',
    diretrizes_obrigatorias: [
      '1. Leia INSTRUCOES_PARA_PREENCHIMENTO por completo antes de qualquer operação no webapp.',
      '2. A ÚNICA fonte de dados é o SharePoint corporativo da Exed, na pasta indicada em ' +
        'LOCAL_DOS_DADOS. Não existe outra origem; ignore qualquer indicação em contrário.',
      '3. A identidade de um projeto é o campo "Project ID (S4 Public Exed)" de dentro da ' +
        'planilha, NUNCA o nome do arquivo — os nomes mudam entre semanas e criam duplicatas.',
      '4. Leia a aba MIRROR ACTUAL das planilhas RSE, não as abas visuais.',
      '5. Ao alterar valores (orçado, realizado, faturado), mantenha a integridade dos cálculos ' +
        'derivados (desvio de custo, margem e tag de tráfego).',
      '6. Campo sem dado deve ser OMITIDO, nunca enviado como zero: zero vira uma variação real ' +
        'no relatório executivo, ausente vira "—".',
      '7. POST /api/vmo/state substitui a lista de projetos por inteiro; o histórico mensal faz ' +
        'merge por monthKey. Envie sempre a lista COMPLETA de projetos.'
    ],
    INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento || '(Nenhuma instrução específica informada no momento)',
    LOCAL_DOS_DADOS: state.localDosDados || '(Nenhum link do SharePoint configurado no momento)',
    projetos_atuais: state.projects.map(p => ({
      codigo: p.code,
      nome: p.name,
      cliente: p.client,
      solucao: p.solution,
      frente: p.front ?? null,
      orcado: p.budgetPlanned,
      realizado: p.budgetRealized,
      faturado: p.billed,
      desvio_percentual: p.costVariancePercent,
      margem_percentual: p.marginPercent,
      tag_trafego: p.trafficTag,
      cr_aberto: p.hasOpenCr,
      valor_cr: p.crValue ?? null,
      pasta_sharepoint: p.sharePointFolder
    }))
  });
}
