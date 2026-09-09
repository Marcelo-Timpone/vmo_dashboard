import React, { useState, useMemo } from 'react';
import { Maximize2, Minimize2, CheckCircle2, AlertCircle } from 'lucide-react';
import { SapProjectFinancial, AppTheme, ContainerParamSettings } from '../types';
import { FilterSolutionType } from './LateralControls';
import { ClientLogo } from './ClientLogo';
import { formatCurrencyBRL } from '../utils/dateUtils';

interface GeneralInfoDashboardProps {
  projects: SapProjectFinancial[];
  selectedFilters: FilterSolutionType[];
  theme?: AppTheme;
  containerSettings?: ContainerParamSettings;
}

export const GeneralInfoDashboard: React.FC<GeneralInfoDashboardProps> = ({
  projects,
  selectedFilters,
  theme = 'neon',
  containerSettings
}) => {
  // State for expanding/reducing any of the 4 containers to full screen
  const [expandedContainer, setExpandedContainer] = useState<1 | 2 | 3 | 4 | null>(null);
  // Sub-filter for ALM container: 'todos' or 'sem_alm' (defaults to 'todos' to show all projects)
  const [almFilter, setAlmFilter] = useState<'todos' | 'sem_alm'>('todos');

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

  // 1. "Projetos com maior uso de orçamento" - sorted by budgetRealized / planned descending
  const resourcesProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      const valB = b.budgetRealized || (b.totalResources ? b.totalResources * 80000 : 0);
      const valA = a.budgetRealized || (a.totalResources ? a.totalResources * 80000 : 0);
      return valB - valA;
    });
  }, [filteredProjects]);

  // 2. "CRs em aberto" - projects with hasOpenCr === true or defined crDescription
  const crProjects = useMemo(() => {
    return filteredProjects.filter(p => p.hasOpenCr || !!p.crDescription);
  }, [filteredProjects]);

  // 3. "Uso de ALM"
  const almUsingProjects = useMemo(() => {
    return filteredProjects.filter(p => p.usesCloudAlm);
  }, [filteredProjects]);

  const almNotUsingProjects = useMemo(() => {
    return filteredProjects.filter(p => !p.usesCloudAlm);
  }, [filteredProjects]);

  const almAdoptionPercent = useMemo(() => {
    if (filteredProjects.length === 0) return 0;
    return Math.round((almUsingProjects.length / filteredProjects.length) * 100);
  }, [filteredProjects, almUsingProjects]);

  // 4. "Avaliações" - sorted by NPS score descending
  const npsProjects = useMemo(() => {
    return [...filteredProjects]
      .filter(p => p.npsScore !== undefined)
      .sort((a, b) => (b.npsScore || 0) - (a.npsScore || 0));
  }, [filteredProjects]);

  // Helper for toggle
  const toggleExpand = (containerId: 1 | 2 | 3 | 4) => {
    setExpandedContainer(prev => (prev === containerId ? null : containerId));
  };

  // Card theme classes
  const isLight = theme === 'light';
  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-[#0A1C30] border-[#16385C] text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.3)]';
  const innerCardBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#071626] border-[#1E436E]';
  const headerBorder = isLight ? 'border-slate-200' : 'border-slate-800';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';
  const rowHover = isLight ? 'hover:bg-slate-100/80' : 'hover:bg-[#0E2847]';
  const tableBorder = isLight ? 'divide-slate-200' : 'divide-slate-800/60';

  return (
    <div className="w-full flex flex-col gap-3 max-w-[1600px] mx-auto select-text pb-4">
      {/* Grid: 2 columns on large screens when not expanded, or single full-width container when expanded */}
      <div className={`grid gap-3 ${expandedContainer ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
        
        {/* ========================================================================= */}
        {/* CONTÊINER 1: PROJETOS COM MAIOR USO DE ORÇAMENTO                          */}
        {/* ========================================================================= */}
        {(expandedContainer === null || expandedContainer === 1) && (
          <div className={`${cardBg} border p-3 flex flex-col justify-between transition-all duration-200 ${expandedContainer === 1 ? 'min-h-[550px]' : 'min-h-[290px]'}`}>
            <div>
              {/* Header */}
              <div className={`flex items-center justify-between gap-2 mb-2 pb-1.5 border-b ${headerBorder}`}>
                <span className="text-xs font-bold uppercase tracking-wide">
                  Projetos com maior uso de orçamento
                </span>
                <span className={`text-[10px] font-semibold ${textMuted}`}>
                  {filteredProjects.length} projetos monitorados
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${headerBorder} text-[10px] font-bold ${textMuted} uppercase`}>
                      <th className="py-1 px-2">Cliente & Frente</th>
                      <th className="py-1 px-2 text-center">Encerramento</th>
                      <th className="py-1 px-2 text-right">Total Orçamento</th>
                      <th className="py-1 px-2 text-right">Restante</th>
                      <th className="py-1 px-2 text-right">Total do gasto reembolsável</th>
                      <th className="py-1 px-2 text-right">Comparativo Mês Ant.</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableBorder}`}>
                    {resourcesProjects.map(p => {
                      const variance = p.resourceVariancePercent || 0;
                      // Se o uso de orçamento comparado ao mês anterior reduziu/economizou (<= 0), verde; se aumentou (> 0), vermelho
                      const isFavorable = variance <= 0;
                      const realizedBudget = p.budgetRealized || (p.totalResources ? p.totalResources * 80000 : 1000000);
                      const remainingBudget = p.budgetPlanned && p.budgetPlanned > realizedBudget 
                        ? p.budgetPlanned - realizedBudget 
                        : (p.remainingResources ? p.remainingResources * 40000 : 150000);
                      const reimbursable = p.reimbursableExpenseTotal ?? 35000;

                      return (
                        <tr key={p.id} className={`${rowHover} transition-colors`}>
                          {/* Coluna 1: Logo + Nome do cliente, na mesma coluna abaixo o nome da frente */}
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-2">
                              <ClientLogo
                                clientName={p.client}
                                logoUrl={p.clientLogo}
                                size="sm"
                                theme={theme}
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-[11px] truncate max-w-[170px]" style={{ color: isLight ? '#0F172A' : '#F1F5F9' }}>
                                  {p.client}
                                </span>
                                <span className={`text-[9px] ${textMuted} font-medium`}>
                                  {p.solution}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Coluna 2: Data de encerramento planejada */}
                          <td className={`py-1.5 px-2 text-center font-mono text-[11px] ${textMuted} whitespace-nowrap`}>
                            {p.plannedEndDate || '31/12/2026'}
                          </td>

                          {/* Coluna 3: Total do orçamento realizado */}
                          <td className="py-1.5 px-2 text-right font-bold font-mono text-[11px] whitespace-nowrap" style={{ color: isLight ? '#0F172A' : '#FFFFFF' }}>
                            {formatCurrencyBRL(realizedBudget)}
                          </td>

                          {/* Coluna 4: Orçamento restante */}
                          <td className={`py-1.5 px-2 text-right font-mono text-[11px] ${textMuted} whitespace-nowrap`}>
                            {formatCurrencyBRL(remainingBudget)}
                          </td>

                          {/* Coluna 5: Total do gasto reembolsável */}
                          <td className="py-1.5 px-2 text-right font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrencyBRL(reimbursable)}
                          </td>

                          {/* Coluna 6: Comparativo com mês anterior (% em verde ou vermelho) */}
                          <td className="py-1.5 px-2 text-right whitespace-nowrap">
                            <span
                              className={`text-[10px] font-bold font-mono px-1.5 py-0.5 border ${
                                isFavorable
                                  ? 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
                                  : 'text-[#FF3366] bg-[#FF3366]/10 border-[#FF3366]/30'
                              }`}
                            >
                              {variance > 0 ? `+${variance.toFixed(1)}%` : `${variance.toFixed(1)}%`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom-right expand / reduce button */}
            <div className="flex justify-end pt-2 mt-2 border-t border-slate-800/40">
              <button
                type="button"
                onClick={() => toggleExpand(1)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer border transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-[#071626] hover:bg-[#0E2847] text-[#00D2FF] hover:text-white border-[#1E436E]'
                }`}
                title={expandedContainer === 1 ? 'Reduzir para grade normal' : 'Expandir para tela cheia mostrando todos os projetos'}
              >
                {expandedContainer === 1 ? (
                  <>
                    <Minimize2 size={12} />
                    <span>Reduzir</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={12} />
                    <span>Expandir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CONTÊINER 2: CRS EM ABERTO                                                */}
        {/* ========================================================================= */}
        {(expandedContainer === null || expandedContainer === 2) && (
          <div className={`${cardBg} border p-3 flex flex-col justify-between transition-all duration-200 ${expandedContainer === 2 ? 'min-h-[550px]' : 'min-h-[290px]'}`}>
            <div>
              {/* Header */}
              <div className={`flex items-center justify-between gap-2 mb-2 pb-1.5 border-b ${headerBorder}`}>
                <span className="text-xs font-bold uppercase tracking-wide">
                  CRs em aberto
                </span>
                <span className="text-[10px] font-bold text-[#F26522] bg-[#F26522]/10 px-1.5 py-0.5 border border-[#F26522]/30">
                  {crProjects.length} solicitações ativas
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${headerBorder} text-[10px] font-bold ${textMuted} uppercase`}>
                      <th className="py-1 px-2">Cliente & Frente</th>
                      <th className="py-1 px-2 text-right">Valor da CR</th>
                      <th className="py-1 px-2 text-center">Data de Abertura</th>
                      <th className="py-1 px-2">Descrição da CR</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableBorder}`}>
                    {crProjects.map(p => {
                      const crVal = p.crValue || 125000;
                      return (
                        <tr key={p.id} className={`${rowHover} transition-colors`}>
                          {/* Logo + Nome do cliente, na mesma coluna abaixo a frente de projeto */}
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-2">
                              <ClientLogo
                                clientName={p.client}
                                logoUrl={p.clientLogo}
                                size="sm"
                                theme={theme}
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-[11px] truncate max-w-[170px]" style={{ color: isLight ? '#0F172A' : '#F1F5F9' }}>
                                  {p.client}
                                </span>
                                <span className={`text-[9px] ${textMuted} font-medium`}>
                                  {p.solution}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Valor da CR (logo antes da coluna de data de abertura) */}
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-[11px] text-[#F26522] whitespace-nowrap">
                            {formatCurrencyBRL(crVal)}
                          </td>

                          {/* Data de abertura */}
                          <td className={`py-1.5 px-2 text-center font-mono text-[11px] ${textMuted} whitespace-nowrap`}>
                            {p.crOpenDate || '10/08/2026'}
                          </td>

                          {/* Descrição da CR */}
                          <td className="py-1.5 px-2 text-[11px]" style={{ color: isLight ? '#334155' : '#E2E8F0' }}>
                            <span className="line-clamp-2">
                              {p.crDescription || 'Adequação de escopo técnico e cronograma de homologação.'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom-right expand / reduce button */}
            <div className="flex justify-end pt-2 mt-2 border-t border-slate-800/40">
              <button
                type="button"
                onClick={() => toggleExpand(2)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer border transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-[#071626] hover:bg-[#0E2847] text-[#00D2FF] hover:text-white border-[#1E436E]'
                }`}
                title={expandedContainer === 2 ? 'Reduzir para grade normal' : 'Expandir para tela cheia mostrando todos os projetos'}
              >
                {expandedContainer === 2 ? (
                  <>
                    <Minimize2 size={12} />
                    <span>Reduzir</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={12} />
                    <span>Expandir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CONTÊINER 3: USO DE ALM                                                   */}
        {/* 25% Quadrado com gráfico de rosca + 75% Tabela Projetos sem uso do ALM    */}
        {/* ========================================================================= */}
        {(expandedContainer === null || expandedContainer === 3) && (
          <div className={`${cardBg} border p-3 flex flex-col justify-between transition-all duration-200 ${expandedContainer === 3 ? 'min-h-[550px]' : 'min-h-[290px]'}`}>
            <div>
              {/* Header */}
              <div className={`flex items-center justify-between gap-2 mb-2 pb-1.5 border-b ${headerBorder}`}>
                <span className="text-xs font-bold uppercase tracking-wide">
                  Uso de ALM
                </span>
                <span className={`text-[10px] font-semibold ${textMuted}`}>
                  {almUsingProjects.length} com ALM / {almNotUsingProjects.length} sem ALM
                </span>
              </div>

              {/* Layout: 25% Donut + 75% Tabela */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-stretch">
                {/* Left 25%: Gráfico de Rosca (Donut Chart) */}
                <div className={`sm:col-span-1 ${innerCardBg} border p-2 flex flex-col items-center justify-center text-center select-none`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1">
                    SAP Cloud ALM
                  </div>

                  <div className="relative w-24 h-24 flex items-center justify-center my-1">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      {/* Background track circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={isLight ? '#E2E8F0' : '#132B47'}
                        strokeWidth="10"
                      />
                      {/* Progress circle arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#00FF88"
                        strokeWidth="10"
                        strokeDasharray={238.76}
                        strokeDashoffset={238.76 * (1 - almAdoptionPercent / 100)}
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Center % */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-black text-white leading-none">
                        {almAdoptionPercent}%
                      </span>
                      <span className={`text-[8px] ${textMuted} font-semibold uppercase mt-0.5`}>
                        Adoção
                      </span>
                    </div>
                  </div>

                  <div className="text-[9px] text-[#00FF88] font-bold mt-1">
                    {almUsingProjects.length} de {filteredProjects.length} projetos
                  </div>
                </div>

                {/* Right 75%: Tabela com todos os projetos ou apenas sem ALM */}
                <div className="sm:col-span-3 overflow-x-auto max-h-[380px] overflow-y-auto">
                  <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-800/40">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAlmFilter('todos')}
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 cursor-pointer border transition-colors ${
                          almFilter === 'todos'
                            ? 'bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/40'
                            : isLight
                            ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            : 'bg-[#071626] text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        Todos ({filteredProjects.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlmFilter('sem_alm')}
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 cursor-pointer border transition-colors ${
                          almFilter === 'sem_alm'
                            ? 'bg-[#FF3366]/15 text-[#FF3366] border-[#FF3366]/40'
                            : isLight
                            ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            : 'bg-[#071626] text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        Sem ALM ({almNotUsingProjects.length})
                      </button>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`border-b ${headerBorder} text-[10px] font-bold ${textMuted} uppercase`}>
                        <th className="py-1 px-2">Cliente & Frente</th>
                        <th className="py-1 px-2 text-right">Status Cloud ALM</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${tableBorder}`}>
                      {(almFilter === 'sem_alm' ? almNotUsingProjects : filteredProjects).map(p => {
                        const isUsing = !!p.usesCloudAlm;
                        return (
                          <tr key={p.id} className={`${rowHover} transition-colors`}>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-2">
                                <ClientLogo
                                  clientName={p.client}
                                  logoUrl={p.clientLogo}
                                  size="sm"
                                  theme={theme}
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-[11px] truncate max-w-[200px]">
                                    {p.client}
                                  </span>
                                  <span className={`text-[9px] ${textMuted}`}>
                                    {p.solution} &bull; {p.name}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border ${
                                isUsing
                                  ? 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
                                  : 'text-[#FF3366] bg-[#FF3366]/10 border-[#FF3366]/30'
                              }`}>
                                {isUsing ? (
                                  <>
                                    <CheckCircle2 size={11} className="text-[#00FF88]" />
                                    <span>Utilizando ALM</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle size={11} className="text-[#FF3366]" />
                                    <span>Sem ALM</span>
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom-right expand / reduce button */}
            <div className="flex justify-end pt-2 mt-2 border-t border-slate-800/40">
              <button
                type="button"
                onClick={() => toggleExpand(3)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer border transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-[#071626] hover:bg-[#0E2847] text-[#00D2FF] hover:text-white border-[#1E436E]'
                }`}
                title={expandedContainer === 3 ? 'Reduzir para grade normal' : 'Expandir para tela cheia mostrando todos os projetos'}
              >
                {expandedContainer === 3 ? (
                  <>
                    <Minimize2 size={12} />
                    <span>Reduzir</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={12} />
                    <span>Expandir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CONTÊINER 4: AVALIAÇÕES                                                   */}
        {/* ========================================================================= */}
        {(expandedContainer === null || expandedContainer === 4) && (
          <div className={`${cardBg} border p-3 flex flex-col justify-between transition-all duration-200 ${expandedContainer === 4 ? 'min-h-[550px]' : 'min-h-[290px]'}`}>
            <div>
              {/* Header */}
              <div className={`flex items-center justify-between gap-2 mb-2 pb-1.5 border-b ${headerBorder}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Avaliações
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 border ${
                    isLight
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-[#071626] text-[#00D2FF] border-[#00D2FF]/30'
                  }`}>
                    Meta NPS: {containerSettings?.npsTargetScore ?? 8.5}
                  </span>
                </div>
                <span className={`text-[10px] font-semibold ${textMuted}`}>
                  NPS Médio:{' '}
                  <strong className="text-[#00FF88]">
                    {(npsProjects.reduce((acc, p) => acc + (p.npsScore || 0), 0) / (npsProjects.length || 1)).toFixed(1)}
                  </strong>
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${headerBorder} text-[10px] font-bold ${textMuted} uppercase`}>
                      <th className="py-1 px-2">Cliente & Frente</th>
                      <th className="py-1 px-2 text-center">Data do NPS</th>
                      <th className="py-1 px-2 text-right">Nota do NPS</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableBorder}`}>
                    {npsProjects.map(p => {
                      const score = p.npsScore ?? 9.0;
                      const npsTarget = containerSettings?.npsTargetScore ?? 8.5;
                      // Color code: >= target Promotor; >= 7.0 Neutro; < 7.0 Detrator
                      const isPromoter = score >= npsTarget;
                      const isNeutral = score >= 7.0 && score < npsTarget;

                      return (
                        <tr key={p.id} className={`${rowHover} transition-colors`}>
                          {/* Logo + Nome do cliente, na mesma coluna abaixo a frente de projeto */}
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-2">
                              <ClientLogo
                                clientName={p.client}
                                logoUrl={p.clientLogo}
                                size="sm"
                                theme={theme}
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-[11px] truncate max-w-[180px]">
                                  {p.client}
                                </span>
                                <span className={`text-[9px] ${textMuted} font-medium`}>
                                  {p.solution}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Data da realização do NPS */}
                          <td className={`py-1.5 px-2 text-center font-mono text-[11px] ${textMuted}`}>
                            {p.npsDate || '25/08/2026'}
                          </td>

                          {/* Nota do NPS */}
                          <td className="py-1.5 px-2 text-right">
                            <span
                              className={`text-[11px] font-mono font-black px-2 py-0.5 border ${
                                isPromoter
                                  ? 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
                                  : isNeutral
                                  ? 'text-[#EAB308] bg-[#EAB308]/10 border-[#EAB308]/30'
                                  : 'text-[#FF3366] bg-[#FF3366]/10 border-[#FF3366]/30'
                              }`}
                            >
                              {score.toFixed(1)} <span className="text-[9px] font-normal">/ 10</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom-right expand / reduce button */}
            <div className="flex justify-end pt-2 mt-2 border-t border-slate-800/40">
              <button
                type="button"
                onClick={() => toggleExpand(4)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer border transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-[#071626] hover:bg-[#0E2847] text-[#00D2FF] hover:text-white border-[#1E436E]'
                }`}
                title={expandedContainer === 4 ? 'Reduzir para grade normal' : 'Expandir para tela cheia mostrando todos os projetos'}
              >
                {expandedContainer === 4 ? (
                  <>
                    <Minimize2 size={12} />
                    <span>Reduzir</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={12} />
                    <span>Expandir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
