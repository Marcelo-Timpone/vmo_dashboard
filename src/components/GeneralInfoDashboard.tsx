import React, { useState, useMemo } from 'react';
import { Maximize2, Minimize2, CheckCircle2, AlertCircle } from 'lucide-react';
import { SapProjectFinancial, AppTheme, ContainerParamSettings, ContainerLayoutConfig, MonthlyKpiSnapshot } from '../types';
import { FilterSolutionType } from './LateralControls';
import { ClientLogo } from './ClientLogo';
import { formatCurrencyBRL } from '../utils/dateUtils';
import { ContainerSlot } from './ContainerSlot';
import { MoMBadge, MoMEmpty } from './MoMBadge';
import {
  computeDelta,
  computeProjectVariance,
  formatDeltaPercent,
  formatDeltaAbs,
  formatDeltaPp,
  latestHistoryMonth
} from '../utils/monthlyComparison';

interface GeneralInfoDashboardProps {
  projects: SapProjectFinancial[];
  selectedFilters: FilterSolutionType[];
  theme?: AppTheme;
  containerSettings?: ContainerParamSettings;
  containerLayout?: ContainerLayoutConfig[];
  isPmo?: boolean;
  monthlyHistory?: MonthlyKpiSnapshot[];
}

export const GeneralInfoDashboard: React.FC<GeneralInfoDashboardProps> = ({
  projects,
  selectedFilters,
  theme = 'neon',
  containerSettings,
  containerLayout,
  isPmo = false,
  monthlyHistory = []
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
        if (filter === 'SCP') return Boolean(p.solution?.includes('SCP'));
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

  // 1. "Projetos com maior uso de orçamento" — ordenado por orçamento realizado.
  // O multiplicador mágico `totalResources * 80000` que existia aqui foi removido:
  // era uma estimativa inventada de custo por recurso, não um dado da RSE.
  const resourcesProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => (b.budgetRealized || 0) - (a.budgetRealized || 0));
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

  // ---------------------------------------------------------------------------
  // COMPARATIVOS MÊS A MÊS (calculados, não digitados)
  // O histórico é agregado do portfólio inteiro, então sob filtro de frente os
  // comparativos são suprimidos: comparar um recorte filtrado contra uma base
  // não filtrada daria um número errado.
  // ---------------------------------------------------------------------------
  const isPortfolioWide = selectedFilters.includes('TODOS') || selectedFilters.length === 0;
  const refMonth = useMemo(() => latestHistoryMonth(monthlyHistory), [monthlyHistory]);

  const deltaFor = (metric: Parameters<typeof computeDelta>[1]) =>
    isPortfolioWide && refMonth
      ? computeDelta(monthlyHistory, metric, refMonth.year, refMonth.month)
      : null;

  const spendDelta = deltaFor('totalSpend');
  const reimbursableDelta = deltaFor('reimbursableTotal');
  const crCountDelta = deltaFor('openCrCount');
  const crValueDelta = deltaFor('openCrValue');
  const almDelta = deltaFor('almAdoptionPercent');
  const npsDelta = deltaFor('npsAvg');

  // Helper for toggle
  const toggleExpand = (containerId: 1 | 2 | 3 | 4) => {
    setExpandedContainer(prev => (prev === containerId ? null : containerId));
  };

  const isBudgetExpanded = expandedContainer === 1;

  // Card theme classes
  // CÓDIGO MORTO (T9): o app é fixo em tema Neon, então isLight é sempre false.
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
          <ContainerSlot id="informacoes_gerais__orcamento" layout={containerLayout} isPmo={isPmo}>
          <div className={`${cardBg} border p-3 flex flex-col justify-between transition-all duration-200 ${expandedContainer === 1 ? 'min-h-[550px]' : 'min-h-[290px]'}`}>
            <div>
              {/* Header */}
              <div className={`flex items-center justify-between gap-2 mb-2 pb-1.5 border-b ${headerBorder}`}>
                <span className="text-xs font-bold uppercase tracking-wide">
                  Projetos com maior uso de orçamento
                </span>
                <div className="flex items-center gap-2">
                  {spendDelta
                    ? <MoMBadge
                        delta={spendDelta}
                        text={formatDeltaPercent(spendDelta)}
                        higherIsBetter={false}
                        theme={theme}
                        suffix="gasto vs mês ant."
                      />
                    : isPortfolioWide && <MoMEmpty theme={theme} />}
                  <span className={`text-[10px] font-semibold ${textMuted}`}>
                    {filteredProjects.length} projetos monitorados
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    {/* T10 — títulos completos só na versão expandida; encolhidos,
                        a tabela cabe sem rolagem horizontal. */}
                    <tr className={`border-b ${headerBorder} text-[10px] font-bold ${textMuted} uppercase`}>
                      <th className={`py-1 px-2 ${isBudgetExpanded ? '' : 'w-[26%]'}`}>Cliente & Frente</th>
                      <th className="py-1 px-2 text-center">Encerramento</th>
                      <th className="py-1 px-2 text-right">Total Orçamento</th>
                      <th className="py-1 px-2 text-right">Restante</th>
                      <th className="py-1 px-2 text-right">
                        {isBudgetExpanded ? 'Total do gasto reembolsável' : 'Reembolsável'}
                      </th>
                      <th className="py-1 px-2 text-right">
                        {isBudgetExpanded ? 'Comparativo Mês Ant.' : 'Variação'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableBorder}`}>
                    {resourcesProjects.map(p => {
                      // Prioridade: histórico por projeto (calculado) > campo
                      // digitado pelo PMO (manual) > nada. Ver computeProjectVariance.
                      const varianceResult = refMonth
                        ? computeProjectVariance(
                            monthlyHistory,
                            p.id,
                            'budgetRealized',
                            refMonth.year,
                            refMonth.month,
                            p.resourceVariancePercent
                          )
                        : (typeof p.resourceVariancePercent === 'number' && p.resourceVariancePercent !== 0
                            ? { percent: p.resourceVariancePercent, source: 'manual' as const }
                            : null);
                      // Gasto que cai (<= 0) é favorável; que sobe é desfavorável.
                      const isFavorable = (varianceResult?.percent ?? 0) <= 0;
                      // Sem invenção: quando o campo não veio da RSE, a célula
                      // mostra "—". Antes havia defaults de R$ 1.000.000,
                      // R$ 150.000 e R$ 35.000 escritos no código, que apareciam
                      // como se fossem números reais do projeto.
                      const realizedBudget = typeof p.budgetRealized === 'number' ? p.budgetRealized : null;
                      const remainingBudget =
                        typeof p.remainingResources === 'number'
                          ? p.remainingResources
                          : typeof p.budgetPlanned === 'number' && realizedBudget !== null
                          ? p.budgetPlanned - realizedBudget
                          : null;
                      const reimbursable =
                        typeof p.reimbursableExpenseTotal === 'number' ? p.reimbursableExpenseTotal : null;

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
                            {p.plannedEndDate || '—'}
                          </td>

                          {/* Coluna 3: Total do orçamento realizado */}
                          <td className="py-1.5 px-2 text-right font-bold font-mono text-[11px] whitespace-nowrap" style={{ color: isLight ? '#0F172A' : '#FFFFFF' }}>
                            {realizedBudget !== null ? formatCurrencyBRL(realizedBudget) : '—'}
                          </td>

                          {/* Coluna 4: Orçamento restante */}
                          <td className={`py-1.5 px-2 text-right font-mono text-[11px] ${textMuted} whitespace-nowrap`}>
                            {remainingBudget !== null ? formatCurrencyBRL(remainingBudget) : '—'}
                          </td>

                          {/* Coluna 5: Total do gasto reembolsável */}
                          <td className="py-1.5 px-2 text-right font-mono text-[11px] font-semibold text-emerald-600 whitespace-nowrap">
                            {reimbursable !== null ? formatCurrencyBRL(reimbursable) : '—'}
                          </td>

                          {/* Coluna 6: Comparativo com mês anterior — CALCULADO
                              quando há histórico por projeto. Sem base, "—":
                              nunca 0,0% fingindo estabilidade. */}
                          <td className="py-1.5 px-2 text-right whitespace-nowrap">
                            {varianceResult ? (
                              <span
                                className={`text-[10px] font-bold font-mono px-1.5 py-0.5 border ${
                                  isFavorable
                                    ? 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
                                    : 'text-[#FF3366] bg-[#FF3366]/10 border-[#FF3366]/30'
                                }`}
                                title={
                                  varianceResult.source === 'calculado'
                                    ? 'Calculado a partir do histórico mensal deste projeto.'
                                    : 'Valor digitado manualmente em Configurações → Projetos. Ainda não há histórico por projeto para calcular.'
                                }
                              >
                                {varianceResult.percent > 0 ? '+' : ''}
                                {varianceResult.percent.toFixed(1)}%
                                {varianceResult.source === 'manual' && (
                                  <span className="ml-0.5 font-normal opacity-70">m</span>
                                )}
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] ${textMuted}`}
                                title="Sem histórico do mês anterior para este projeto."
                              >
                                —
                              </span>
                            )}
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
          </ContainerSlot>
        )}

        {/* ========================================================================= */}
        {/* CONTÊINER 2: CRS EM ABERTO                                                */}
        {/* ========================================================================= */}
        {(expandedContainer === null || expandedContainer === 2) && (
          <ContainerSlot id="informacoes_gerais__crs_abertos" layout={containerLayout} isPmo={isPmo}>
          <div className={`${cardBg} border p-3 flex flex-col justify-between transition-all duration-200 ${expandedContainer === 2 ? 'min-h-[550px]' : 'min-h-[290px]'}`}>
            <div>
              {/* Header */}
              <div className={`flex items-center justify-between gap-2 mb-2 pb-1.5 border-b ${headerBorder}`}>
                <span className="text-xs font-bold uppercase tracking-wide">
                  CRs em aberto
                </span>
                <div className="flex items-center gap-2">
                  {crValueDelta
                    ? <MoMBadge
                        delta={crValueDelta}
                        text={formatDeltaPercent(crValueDelta)}
                        higherIsBetter={false}
                        theme={theme}
                        suffix="em valor"
                      />
                    : isPortfolioWide && <MoMEmpty theme={theme} />}
                  {crCountDelta
                    ? <MoMBadge
                        delta={crCountDelta}
                        text={formatDeltaAbs(crCountDelta)}
                        higherIsBetter={false}
                        theme={theme}
                        suffix="CRs"
                      />
                    : null}
                  <span className="text-[10px] font-bold text-exed-accent bg-exed-accent/10 px-1.5 py-0.5 border border-exed-accent/30">
                    {crProjects.length} solicitações ativas
                  </span>
                </div>
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
                      const crVal = p.crValue;
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
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-[11px] text-exed-accent whitespace-nowrap">
                            {typeof crVal === 'number' ? formatCurrencyBRL(crVal) : '—'}
                          </td>

                          {/* Data de abertura */}
                          <td className={`py-1.5 px-2 text-center font-mono text-[11px] ${textMuted} whitespace-nowrap`}>
                            {p.crOpenDate || '—'}
                          </td>

                          {/* Descrição da CR */}
                          <td className="py-1.5 px-2 text-[11px]" style={{ color: isLight ? '#334155' : '#E2E8F0' }}>
                            <span className="line-clamp-2">
                              {p.crDescription || '—'}
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
          </ContainerSlot>
        )}

        {/* ========================================================================= */}
        {/* CONTÊINER 3: USO DE ALM                                                   */}
        {/* 25% Quadrado com gráfico de rosca + 75% Tabela Projetos sem uso do ALM    */}
        {/* ========================================================================= */}
        {(expandedContainer === null || expandedContainer === 3) && (
          <ContainerSlot id="informacoes_gerais__uso_alm" layout={containerLayout} isPmo={isPmo}>
          <div className={`${cardBg} border p-3 flex flex-col justify-between transition-all duration-200 ${expandedContainer === 3 ? 'min-h-[550px]' : 'min-h-[290px]'}`}>
            <div>
              {/* Header */}
              <div className={`flex items-center justify-between gap-2 mb-2 pb-1.5 border-b ${headerBorder}`}>
                <span className="text-xs font-bold uppercase tracking-wide">
                  Uso de ALM
                </span>
                <div className="flex items-center gap-2">
                  {almDelta
                    ? <MoMBadge delta={almDelta} text={formatDeltaPp(almDelta)} theme={theme} />
                    : isPortfolioWide && <MoMEmpty theme={theme} />}
                  <span className={`text-[10px] font-semibold ${textMuted}`}>
                    {almUsingProjects.length} com ALM / {almNotUsingProjects.length} sem ALM
                  </span>
                </div>
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
          </ContainerSlot>
        )}

        {/* ========================================================================= */}
        {/* CONTÊINER 4: AVALIAÇÕES                                                   */}
        {/* ========================================================================= */}
        {(expandedContainer === null || expandedContainer === 4) && (
          <ContainerSlot id="informacoes_gerais__avaliacoes" layout={containerLayout} isPmo={isPmo}>
          <div className={`${cardBg} border p-3 flex flex-col justify-between transition-all duration-200 ${expandedContainer === 4 ? 'min-h-[550px]' : 'min-h-[290px]'}`}>
            <div>
              {/* Header */}
              <div className={`flex items-center justify-between gap-2 mb-2 pb-1.5 border-b ${headerBorder}`}>
                <span className="text-xs font-bold uppercase tracking-wide">
                  Avaliações
                </span>
                {/* T7 — o valor da meta de NPS saiu da interface; o que fica é o
                    número real e a variação contra o mês anterior. */}
                <div className="flex items-center gap-2">
                  {npsDelta
                    ? <MoMBadge delta={npsDelta} text={formatDeltaPp(npsDelta)} theme={theme} />
                    : isPortfolioWide && <MoMEmpty theme={theme} />}
                  <span className={`text-[10px] font-semibold ${textMuted}`}>
                    NPS Médio:{' '}
                    <strong className="text-[#00FF88]">
                      {npsProjects.length > 0
                        ? (npsProjects.reduce((acc, p) => acc + (p.npsScore || 0), 0) / npsProjects.length).toFixed(1)
                        : '—'}
                    </strong>
                  </span>
                </div>
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
                      // npsProjects já filtra por npsScore !== undefined, então
                      // aqui o valor sempre existe — sem default inventado.
                      const score = p.npsScore as number;
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
                            {p.npsDate || '—'}
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
          </ContainerSlot>
        )}

      </div>
    </div>
  );
};
