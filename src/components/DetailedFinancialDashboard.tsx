import React, { useMemo } from 'react';
import { SapProjectFinancial, AppTheme } from '../types';
import { formatCurrencyBRL } from '../utils/dateUtils';
import { FilterSolutionType } from './LateralControls';
import { ClientLogo } from './ClientLogo';

interface DetailedFinancialDashboardProps {
  projects: SapProjectFinancial[];
  selectedFilters: FilterSolutionType[];
  theme?: AppTheme;
}

export const DetailedFinancialDashboard: React.FC<DetailedFinancialDashboardProps> = ({
  projects,
  selectedFilters,
  theme = 'neon'
}) => {
  const isLight = theme === 'light';

  // Filter projects by selected SAP solutions
  const filteredProjects = useMemo(() => {
    if (selectedFilters.includes('TODOS') || selectedFilters.length === 0) {
      return projects;
    }
    return projects.filter(p => {
      return selectedFilters.some(filter => {
        if (filter === 'SCP') return p.solution.includes('SCP');
        return p.solution === filter;
      });
    });
  }, [projects, selectedFilters]);

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
      const plannedRev = Math.round((p.budgetPlanned || 0) / (1 - (p.marginPercent || 24) / 100));
      return acc + plannedRev;
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
      (acc, p) => acc + (p.budgetRealized || (p.totalResources ? p.totalResources * 80000 : 0)),
      0
    );
  }, [filteredProjects]);

  const weightedAverageMargin = useMemo(() => {
    if (totalBilledRevenue === 0) return 0;
    const totalMarginBRL = filteredProjects.reduce(
      (acc, p) => acc + (p.billed || 0) * (p.marginPercent / 100),
      0
    );
    return (totalMarginBRL / totalBilledRevenue) * 100;
  }, [filteredProjects, totalBilledRevenue]);

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
      <div className={`${containerBg} border p-3 flex flex-col`}>
        {/* Table Title Bar */}
        <div className={`flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#F26522]">
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
              </tr>
            </thead>
            <tbody className={`divide-y ${borderDivider}`}>
              {filteredProjects.map(p => {
                const plannedRevenue = Math.round((p.budgetPlanned || 0) / (1 - (p.marginPercent || 24) / 100));
                const plannedBudget = p.budgetPlanned || 0;
                const realBudget = p.budgetRealized || (p.totalResources ? p.totalResources * 80000 : 0);
                const margin = p.marginPercent;
                const isMarginOk = margin >= 24.0;
                const isMarginWarning = margin >= 20.0 && margin < 24.0;

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
                        {p.solution}
                      </span>
                    </td>

                    {/* Coluna 4: Faturamento Planejado Total */}
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] whitespace-nowrap text-slate-400">
                      {formatCurrencyBRL(plannedRevenue)}
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
                        {margin.toFixed(1)}%
                      </span>
                    </td>
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
                <td className="py-3 px-3 text-right font-mono text-[#F26522]">
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
                    weightedAverageMargin >= 24.0
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
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
