import React, { useMemo } from 'react';
import { SapProjectFinancial, AppTheme, ContainerLayoutConfig, ContainerParamSettings, MonthlyKpiSnapshot } from '../types';
import { formatCurrencyBRL } from '../utils/dateUtils';
import { FilterSolutionType } from './LateralControls';
import { useCatalogo } from '../context/CatalogoContext';
import { filtrarProjetosPorPortfolio } from '../utils/portfolio';
import { ClientLogo } from './ClientLogo';
import { ContainerSlot } from './ContainerSlot';
import { MoMBadge, MoMEmpty } from './MoMBadge';
import {
  computeDelta,
  computeProjectVariance,
  formatDeltaPercent,
  formatDeltaPp,
  latestHistoryMonth,
  hasProjectSnapshots
} from '../utils/monthlyComparison';

/**
 * Receita planejada do projeto: usa a receita contratada da RSE (CTR + CR)
 * quando existir. Só na falta dela deriva pelo custo planejado e pela margem.
 */
function receitaPlanejadaDoProjeto(p: SapProjectFinancial): number | null {
  if (typeof p.contractRevenue === 'number' && Number.isFinite(p.contractRevenue)) return p.contractRevenue;
  if (!p.budgetPlanned || typeof p.marginPercent !== 'number' || p.marginPercent >= 100) return null;
  return Math.round(p.budgetPlanned / (1 - p.marginPercent / 100));
}

interface DetailedFinancialDashboardProps {
  projects: SapProjectFinancial[];
  selectedFilters: FilterSolutionType[];
  theme?: AppTheme;
  containerLayout?: ContainerLayoutConfig[];
  isPmo?: boolean;
  containerSettings?: ContainerParamSettings;
  monthlyHistory?: MonthlyKpiSnapshot[];
}

export const DetailedFinancialDashboard: React.FC<DetailedFinancialDashboardProps> = ({
  projects,
  selectedFilters,
  theme = 'neon',
  containerLayout,
  isPmo = false,
  containerSettings,
  monthlyHistory = []
}) => {
  const rot = useCatalogo();
  // CÓDIGO MORTO (T9): o app é fixo em tema Neon, então isLight é sempre false.
  const isLight = theme === 'light';

  // Filtra por frente e solução (itens do mesmo grupo somam; grupos se cruzam)
  const filteredProjects = useMemo(
    () => filtrarProjetosPorPortfolio(projects, selectedFilters, rot.catalogo),
    [projects, selectedFilters, rot.catalogo]
  );

  // Client monogram helper
  const getClientInitials = (name: string) => {
    return name
      .split(' ')
      .filter(w => w.length > 2)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  };

  // Aggregated totals
  const totalPlannedRevenue = useMemo(() => {
    return filteredProjects.reduce((acc, p) => {
      // Sem margem no projeto, não dá para derivar o faturamento planejado —
      // o "|| 24" que existia aqui era uma margem chutada.
      const receita = receitaPlanejadaDoProjeto(p);
      return receita === null ? acc : acc + receita;
    }, 0);
  }, [filteredProjects]);

  const totalBilledRevenue = useMemo(() => {
    return filteredProjects.reduce((acc, p) => acc + (p.billed || 0), 0);
  }, [filteredProjects]);

  const totalPlannedBudget = useMemo(() => {
    return filteredProjects.reduce((acc, p) => acc + (p.budgetPlanned || 0), 0);
  }, [filteredProjects]);

  const totalRealBudget = useMemo(() => {
    return filteredProjects.reduce(
      (acc, p) => acc + (p.budgetRealized || 0),
      0
    );
  }, [filteredProjects]);

  const weightedAverageMargin = useMemo(() => {
    // Só entram projetos com margem conhecida, no numerador e no denominador.
    const comMargem = filteredProjects.filter(p => typeof p.marginPercent === 'number' && Number.isFinite(p.marginPercent));
    const base = comMargem.reduce((acc, p) => acc + (p.billed || 0), 0);
    if (base === 0) return 0;
    const totalMarginBRL = comMargem.reduce((acc, p) => acc + (p.billed || 0) * (p.marginPercent / 100), 0);
    return (totalMarginBRL / base) * 100;
  }, [filteredProjects]);

  // ---------------------------------------------------------------------------
  // COMPARATIVOS MÊS A MÊS
  // ---------------------------------------------------------------------------
  const isPortfolioWide = selectedFilters.includes('TODOS') || selectedFilters.length === 0;
  const refMonth = useMemo(() => latestHistoryMonth(monthlyHistory), [monthlyHistory]);
  const perProjectAvailable = useMemo(() => hasProjectSnapshots(monthlyHistory), [monthlyHistory]);

  const deltaFor = (metric: Parameters<typeof computeDelta>[1]) =>
    isPortfolioWide && refMonth
      ? computeDelta(monthlyHistory, metric, refMonth.year, refMonth.month)
      : null;

  const revenueDelta = deltaFor('revenueBilled');
  const spendDelta = deltaFor('totalSpend');
  const plannedBudgetDelta = deltaFor('plannedBudgetTotal');
  const marginDelta = deltaFor('marginAvg');

  const marginTarget = containerSettings?.contractMarginTarget;
  const hasMarginTarget =
    typeof marginTarget === 'number' && Number.isFinite(marginTarget) && marginTarget > 0;
  // Sem meta configurada, a cor da margem usa a média ponderada do portfólio.
  const marginBaseline = hasMarginTarget ? (marginTarget as number) : weightedAverageMargin;

  // Theme styling helpers
  const containerBg = isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
    : 'bg-[#0A1C30] border-[#16385C] text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.3)]';
  const tableHeaderBg = isLight
    ? 'bg-slate-100 border-slate-200 text-slate-700'
    : 'bg-[#071626] border-slate-800 text-slate-300';
  const rowHover = isLight ? 'hover:bg-slate-50' : 'hover:bg-[#0E2847]/80';
  const borderDivider = isLight ? 'divide-slate-200' : 'divide-slate-800/70';
  const footerBg = isLight
    ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold'
    : 'bg-[#071728] border-slate-800 text-white font-bold';

  return (
    <div className="w-full flex flex-col gap-2 max-w-[1600px] mx-auto select-text pb-4">
      {/* Main Table Container */}
      <ContainerSlot id="detalhamento_financeiro__tabela" layout={containerLayout} isPmo={isPmo}>
      <div className={`${containerBg} border p-3 flex flex-col`}>
        {/* Table Title Bar */}
        <div className={`flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-exed-accent">
              Demonstrativo Consolidado de Projetos & Faturamento
            </span>
            <span className={`text-[10px] px-2 py-0.5 border font-semibold ${
              isLight
                ? 'bg-slate-100 border-slate-200 text-slate-600'
                : 'bg-[#071626] border-slate-700 text-slate-400'
            }`}>
              {filteredProjects.length} {filteredProjects.length === 1 ? 'projeto listado' : 'projetos listados'}
            </span>
          </div>

          <div className="text-[10px] text-slate-400">
            Filtro ativo: <span className="font-semibold text-slate-300">{selectedFilters.join(', ')}</span>
          </div>
        </div>

        {/* Large Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead>
              <tr className={`border-b ${tableHeaderBg} text-[10px] uppercase font-bold tracking-wider`}>
                <th className="py-2.5 px-3">Logo + Nome do Cliente</th>
                <th className="py-2.5 px-3">Nome do Projeto</th>
                <th className="py-2.5 px-3 text-center">Frente do Projeto</th>
                <th className="py-2.5 px-3 text-right">Faturamento Planejado Total</th>
                <th className="py-2.5 px-3 text-right">Faturamento Real Total</th>
                <th className="py-2.5 px-3 text-right">Uso de Orçamento Total Planejado</th>
                <th className="py-2.5 px-3 text-right">Uso de Orçamento Total Real</th>
                <th className="py-2.5 px-3 text-right">Margem de Contribuição</th>
                {perProjectAvailable && (
                  <th className="py-2.5 px-3 text-right">Δ Faturamento vs Mês Ant.</th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${borderDivider}`}>
              {filteredProjects.map(p => {
                // Sem orçado ou sem margem, não há como derivar o faturamento
                // planejado — a linha mostra "—" em vez de assumir margem 24%.
                const plannedRevenue = receitaPlanejadaDoProjeto(p);
                const plannedBudget = p.budgetPlanned || 0;
                const realBudget = p.budgetRealized || 0;
                const margin = p.marginPercent;
                // Referência: a meta quando configurada, senão a média ponderada.
                const semMargem = !(typeof margin === 'number' && Number.isFinite(margin));
                const isMarginOk = !semMargem && margin >= marginBaseline;
                const isMarginWarning = semMargem || (!isMarginOk && margin >= marginBaseline - 4);

                const billedVariance = refMonth
                  ? computeProjectVariance(monthlyHistory, p.id, 'billed', refMonth.year, refMonth.month)
                  : null;

                const marginBadgeClass = isMarginOk
                  ? isLight
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
                  : isMarginWarning
                  ? isLight
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-[#EAB308] bg-[#EAB308]/10 border-[#EAB308]/30'
                  : isLight
                  ? 'text-red-700 bg-red-50 border-red-200'
                  : 'text-[#FF3366] bg-[#FF3366]/10 border-[#FF3366]/30';

                return (
                  <tr key={p.id} className={`${rowHover} transition-colors`}>
                    {/* Coluna 1: Logo + Nome do Cliente */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <ClientLogo
                          clientName={p.client}
                          logoUrl={p.clientLogo}
                          size="md"
                          theme={theme}
                        />
                        <span className="font-bold text-[11px] truncate max-w-[200px]" style={{ color: isLight ? '#0F172A' : '#F1F5F9' }}>
                          {p.client}
                        </span>
                      </div>
                    </td>

                    {/* Coluna 2: Nome do Projeto */}
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-[11px]" style={{ color: isLight ? '#334155' : '#CBD5E1' }}>
                        {p.name}
                      </span>
                    </td>

                    {/* Coluna 3: Frente do Projeto */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 border ${
                        isLight
                          ? 'bg-slate-50 text-slate-700 border-slate-200'
                          : 'bg-[#06121E] text-slate-300 border-slate-700'
                      }`}>
                        {rot.solucao(p.solution)}
                      </span>
                    </td>

                    {/* Coluna 4: Faturamento Planejado Total */}
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] whitespace-nowrap text-slate-400">
                      {plannedRevenue !== null ? formatCurrencyBRL(plannedRevenue) : '—'}
                    </td>

                    {/* Coluna 5: Faturamento Real Total */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[11px] whitespace-nowrap" style={{ color: isLight ? '#0F172A' : '#FFFFFF' }}>
                      {formatCurrencyBRL(p.billed)}
                    </td>

                    {/* Coluna 6: Uso de Orçamento Total Planejado */}
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {formatCurrencyBRL(plannedBudget)}
                    </td>

                    {/* Coluna 7: Uso de Orçamento Total Real */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[11px] whitespace-nowrap" style={{ color: isLight ? '#0F172A' : '#FFFFFF' }}>
                      {formatCurrencyBRL(realBudget)}
                    </td>

                    {/* Coluna 8: Margem de Contribuição */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <span className={`font-mono font-bold text-[11px] px-2 py-0.5 border ${marginBadgeClass}`}>
                        {semMargem ? '—' : `${margin.toFixed(1)}%`}
                      </span>
                    </td>

                    {/* Coluna 9: variação de faturamento do projeto, calculada
                        a partir do histórico por projeto. */}
                    {perProjectAvailable && (
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {billedVariance ? (
                          <span
                            className={`font-mono font-bold text-[11px] px-2 py-0.5 border ${
                              billedVariance.percent >= 0
                                ? isLight
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
                                : isLight
                                ? 'text-red-700 bg-red-50 border-red-200'
                                : 'text-[#FF3366] bg-[#FF3366]/10 border-[#FF3366]/30'
                            }`}
                          >
                            {billedVariance.percent > 0 ? '+' : ''}
                            {billedVariance.percent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500" title="Sem snapshot deste projeto no mês anterior.">
                            —
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>

            {/* Consolidated Summary Footer */}
            <tfoot>
              <tr className={`border-t-2 ${footerBg} text-xs`}>
                <td className="py-3 px-3 uppercase tracking-wider" colSpan={3}>
                  Totais Consolidados ({filteredProjects.length} projetos)
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  {formatCurrencyBRL(totalPlannedRevenue)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-exed-accent">
                  {formatCurrencyBRL(totalBilledRevenue)}
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  {formatCurrencyBRL(totalPlannedBudget)}
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  {formatCurrencyBRL(totalRealBudget)}
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  <span className={`px-2 py-0.5 border ${
                    weightedAverageMargin >= marginBaseline
                      ? isLight
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
                      : isLight
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : 'text-[#EAB308] bg-[#EAB308]/10 border-[#EAB308]/30'
                  }`}>
                    {weightedAverageMargin.toFixed(1)}%
                  </span>
                </td>
                {perProjectAvailable && <td className="py-3 px-3" />}
              </tr>

              {/* Linha de comparativo consolidado contra o mês anterior.
                  Só aparece quando existe base para calcular. */}
              {isPortfolioWide && (revenueDelta || spendDelta || plannedBudgetDelta || marginDelta) && (
                <tr className={`${isLight ? 'bg-slate-50 text-slate-700' : 'bg-[#050F1A] text-slate-300'} text-xs`}>
                  <td className="py-2 px-3 uppercase tracking-wider text-[10px] font-bold" colSpan={3}>
                    Variação vs mês anterior
                  </td>
                  <td className="py-2 px-3 text-right">
                    {plannedBudgetDelta
                      ? <MoMBadge delta={plannedBudgetDelta} text={formatDeltaPercent(plannedBudgetDelta)} theme={theme} suffix="" neutral />
                      : <MoMEmpty theme={theme} />}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {revenueDelta
                      ? <MoMBadge delta={revenueDelta} text={formatDeltaPercent(revenueDelta)} theme={theme} suffix="" />
                      : <MoMEmpty theme={theme} />}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {plannedBudgetDelta
                      ? <MoMBadge delta={plannedBudgetDelta} text={formatDeltaPercent(plannedBudgetDelta)} theme={theme} suffix="" neutral />
                      : <MoMEmpty theme={theme} />}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {spendDelta
                      ? <MoMBadge delta={spendDelta} text={formatDeltaPercent(spendDelta)} higherIsBetter={false} theme={theme} suffix="" />
                      : <MoMEmpty theme={theme} />}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {marginDelta
                      ? <MoMBadge delta={marginDelta} text={formatDeltaPp(marginDelta)} theme={theme} suffix="" />
                      : <MoMEmpty theme={theme} />}
                  </td>
                  {perProjectAvailable && <td className="py-2 px-3" />}
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
      </ContainerSlot>
    </div>
  );
};
