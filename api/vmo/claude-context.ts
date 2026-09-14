import { handlePreflight, isAuthorized, sendUnauthorized } from '../../lib/apiAuth';
import { loadState } from '../../lib/vmoState';

export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;
  if (!isAuthorized(req)) return sendUnauthorized(res);

  const state = await loadState();

  res.status(200).json({
    papel: 'Assistente Corporativo Exed Consulting - VMO',
    diretrizes_obrigatorias: [
      "1. Você SEMPRE deve ler 'INSTRUCOES_PARA_PREENCHIMENTO' e 'LOCAL_DOS_DADOS' primeiro antes de qualquer operação no webapp, a não ser que o usuário da empresa forneça outro comando explícito.",
      "2. O campo 'LOCAL_DOS_DADOS' aponta para a pasta do SharePoint corporativo onde se encontram as planilhas financeiras dos projetos SAP.",
      "3. Ao fazer alterações de valores (orçado, realizado, faturado), mantenha a integridade dos cálculos (desvios de custo, margem estimada e tags de tráfego verde/amarelo/vermelho).",
      "4. Qualquer modificação enviada para POST /api/vmo/state atualiza os dashboards do webapp instantaneamente."
    ],
    INSTRUCOES_PARA_PREENCHIMENTO: state.instrucoesPreenchimento || '(Nenhuma instrução específica informada no momento)',
    LOCAL_DOS_DADOS: state.localDosDados || '(Nenhum link do SharePoint configurado no momento)',
    projetos_atuais: state.projects.map(p => ({
      codigo: p.code,
      nome: p.name,
      cliente: p.client,
      solucao: p.solution,
      orcado: p.budgetPlanned,
      realizado: p.budgetRealized,
      faturado: p.billed,
      desvio_percentual: p.costVariancePercent,
      margem_percentual: p.marginPercent,
      tag_trafego: p.trafficTag,
      cr_aberto: p.hasOpenCr,
      valor_cr: p.crValue || 0,
      pasta_sharepoint: p.sharePointFolder
    }))
  });
}
