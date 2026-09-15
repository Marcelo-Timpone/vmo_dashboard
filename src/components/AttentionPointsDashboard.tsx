import React, { useMemo } from 'react';
import { SapProjectFinancial, AppTheme, ContainerParamSettings, ContainerLayoutConfig, MonthlyKpiSnapshot } from '../types';
import { formatCurrencyBRL } from '../utils/dateUtils';
import { FilterSolutionType } from './LateralControls';
import { ClientLogo } from './ClientLogo';
import { ContainerSlot } from './ContainerSlot';
import { MoMBadge, MoMEmpty } from './MoMBadge';
import {
  computeDelta,
  formatDeltaPp,
  formatDeltaAbs,
  latestHistoryMonth
} from '../utils/monthlyComparison';

interface AttentionPointsDashboardProps {
  projects: SapProjectFinancial[];
  selectedFilters: FilterSolutionType[];
  theme?: AppTheme;
  containerSettings?: ContainerParamSettings;
  containerLayout?: ContainerLayoutConfig[];
  isPmo?: boolean;
  monthlyHistory?: MonthlyKpiSnapshot[];
}

export const AttentionPointsDashboard: React.FC<AttentionPointsDashboardProps> = ({
  projects,
  selectedFilters,
  theme = 'neon',
  containerSettings,
  containerLayout,
  isPmo = false,
  monthlyHistory = []
}) => {
  // CÓDIGO MORTO (T9): o app é fixo em tema Neon, então isLight é sempre false.
  const isLight = theme === 'light';
  // T7 — metas opcionais. Sem meta configurada, não há "abaixo da meta":
  // a detração de margem passa a ser medida contra a média do próprio portfólio.
  const rawMarginTarget = containerSettings?.contractMarginTarget;
  const hasMarginTarget =
    typeof rawMarginTarget === 'number' && Number.isFinite(rawMarginTarget) && rawMarginTarget > 0;
  const governanceThreshold = containerSettings?.governanceComplianceThreshold ?? 80.0;

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

  // --------------------------------------------------------------------------
  // 1. PROJETOS DETRATORES
  // Tabela 1: Clientes com maior detração na receita (3 menores faturamentos abaixo da meta orçada)
  // Tabela 2: Clientes com maior detração na margem (3 menores margens abaixo da meta contratual)
  // --------------------------------------------------------------------------
  const detractorRevenue = useMemo(() => {
    return filteredProjects
      .filter(p => p.billed < p.budgetPlanned)
      .sort((a, b) => a.billed - b.billed)
      .slice(0, 3);
  }, [filteredProjects]);

  const portfolioAvgMargin = useMemo(() => {
    if (filteredProjects.length === 0) return null;
    return filteredProjects.reduce((acc, p) => acc + p.marginPercent, 0) / filteredProjects.length;
  }, [filteredProjects]);

  // Referência de detração: a meta quando existe, senão a média do portfólio.
  const marginBaseline = hasMarginTarget ? (rawMarginTarget as number) : portfolioAvgMargin;

  const detractorMargin = useMemo(() => {
    if (marginBaseline === null) return [];
    return filteredProjects
      .filter(p => p.marginPercent < marginBaseline)
      .sort((a, b) => a.marginPercent - b.marginPercent)
      .slice(0, 3);
  }, [filteredProjects, marginBaseline]);

  // --------------------------------------------------------------------------
  // 2. ADERÊNCIA AOS CRONOGRAMAS E ATRASOS
  // 25%: Gráfico de arco preenchido com gradiente contínuo (94.0% até 100.0%)
  // 75%: Tabela "Projetos com atrasos registrados"
  // --------------------------------------------------------------------------
  const delayedProjects = useMemo(() => {
    return filteredProjects
      .filter(p => (p.scheduleDelayPercent || 0) > 0)
      .sort((a, b) => (b.scheduleDelayPercent || 0) - (a.scheduleDelayPercent || 0));
  }, [filteredProjects]);

  // Aderência média = 100 - atraso médio. Sem projetos, não há aderência:
  // o 98,5% que ficava aqui era um número inventado para o gráfico não ficar
  // vazio. O piso da escala continua sendo só a escala do gráfico.
  const averageAdherence = useMemo(() => {
    if (filteredProjects.length === 0) return null;
    const totalDelay = filteredProjects.reduce((acc, p) => acc + (p.scheduleDelayPercent || 0), 0);
    return 100.0 - totalDelay / filteredProjects.length;
  }, [filteredProjects]);

  const gaugeMin = containerSettings?.gaugeMinScale ?? 94.0;

  // Arc length and filled progress calculation:
  // Semi-circular arc radius R = 55, arc length = pi * 55 ≈ 172.8
  const ARC_LENGTH = 172.8;
  const progressRatio =
    averageAdherence === null
      ? 0
      : Math.max(0, Math.min(1, (averageAdherence - gaugeMin) / (100.0 - gaugeMin)));
  const strokeOffset = ARC_LENGTH * (1 - progressRatio);

  // --------------------------------------------------------------------------
  // 3. DOCUMENTAÇÃO REGISTRADA AO PMO E ASSINADA
  // --------------------------------------------------------------------------
  const documentationList = useMemo(() => {
    return filteredProjects.map(p => {
      // Sem default de 85%: projeto sem o dado aparece com a barra vazia e um
      // rótulo "sem dado", em vez de uma barra quase cheia que ninguém mediu.
      const pct = typeof p.signedDocumentsPercent === 'number' ? p.signedDocumentsPercent : null;
      return {
        id: p.id,
        client: p.client,
        clientLogo: p.clientLogo,
        solution: p.solution,
        isLegacy: !!p.isLegacyDocs,
        pct
      };
    });
  }, [filteredProjects]);

  // ---------------------------------------------------------------------------
  // COMPARATIVOS MÊS A MÊS
  // O histórico é agregado do portfólio, então sob filtro de frente ficam ocultos.
  // ---------------------------------------------------------------------------
  const isPortfolioWide = selectedFilters.includes('TODOS') || selectedFilters.length === 0;
  const refMonth = useMemo(() => latestHistoryMonth(monthlyHistory), [monthlyHistory]);

  const deltaFor = (metric: Parameters<typeof computeDelta>[1]) =>
    isPortfolioWide && refMonth
      ? computeDelta(monthlyHistory, metric, refMonth.year, refMonth.month)
      : null;

  const delayDelta = deltaFor('avgScheduleDelay');
  const docsDelta = deltaFor('signedDocsAvg');
  const detractorDelta = deltaFor('detractorCount');

  return (
    <div className={`w-full flex flex-col gap-2 max-w-[1600px] mx-auto ${
      isLight ? 'text-slate-900' : 'text-slate-100'
    }`}>
      {/* ========================================================================= */}
      {/* 1. PROJETOS DETRATORES                                                    */}
      {/* ========================================================================= */}
      <ContainerSlot id="pontos_atencao__detratores" layout={containerLayout} isPmo={isPmo}>
      <div className={`p-2.5 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0A1C30] border-[#16385C] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide mb-2 pb-1 border-b ${
          isLight ? 'text-slate-900 border-slate-200' : 'text-white border-slate-800'
        }`}>
          <span>Projetos detratores</span>
          {detractorDelta
            ? <MoMBadge
                delta={detractorDelta}
                text={formatDeltaAbs(detractorDelta)}
                higherIsBetter={false}
                theme={theme}
                suffix="detratores vs mês ant."
              />
            : isPortfolioWide && <MoMEmpty theme={theme} />}
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x gap-y-2 lg:gap-y-0 ${
          isLight ? 'divide-slate-200' : 'divide-slate-800'
        }`}>
          {/* Tabela 1: Clientes com maior detração na receita */}
          <div className="lg:pr-3">
            <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              Clientes com maior detração na receita
            </div>

            {detractorRevenue.length === 0 ? (
              <div className={`text-xs py-3 text-center italic border ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-500'
                  : 'bg-[#071626] border-slate-800 text-slate-400'
              }`}>
                Nenhum cliente abaixo da meta de receita no período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b text-[10px] font-bold uppercase ${
                      isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                    }`}>
                      <th className="py-1 px-2">Cliente</th>
                      <th className="py-1 px-2">Frente de solução</th>
                      <th className="py-1 px-2 text-right">Total do faturamento</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                    {detractorRevenue.map(p => (
                      <tr key={p.id} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-[#0E2847]'}>
                        <td className="py-1 px-2 flex items-center gap-1.5 font-medium">
                          <ClientLogo
                            clientName={p.client}
                            logoUrl={p.clientLogo}
                            size="xs"
                            theme={theme}
                          />
                          <span className="truncate max-w-[170px] text-[11px]">{p.client}</span>
                        </td>
                        <td className="py-1 px-2">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 border ${
                            isLight
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-[#071626] text-slate-300 border-slate-700'
                          }`}>
                            {p.solution}
                          </span>
                        </td>
                        <td className={`py-1 px-2 text-right font-mono font-bold text-[11px] ${
                          isLight ? 'text-red-600' : 'text-[#FF3366]'
                        }`}>
                          {formatCurrencyBRL(p.billed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabela 2: Clientes com maior detração na margem */}
          <div className="lg:pl-3">
            <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              Clientes com maior detração na margem
            </div>

            {detractorMargin.length === 0 ? (
              <div className={`text-xs py-3 text-center italic border ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-500'
                  : 'bg-[#071626] border-slate-800 text-slate-400'
              }`}>
                Nenhum cliente abaixo da referência de margem no período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b text-[10px] font-bold uppercase ${
                      isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                    }`}>
                      <th className="py-1 px-2">Cliente</th>
                      <th className="py-1 px-2">Frente de solução</th>
                      <th className="py-1 px-2 text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                    {detractorMargin.map(p => (
                      <tr key={p.id} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-[#0E2847]'}>
                        <td className="py-1 px-2 flex items-center gap-1.5 font-medium">
                          <ClientLogo
                            clientName={p.client}
                            logoUrl={p.clientLogo}
                            size="xs"
                            theme={theme}
                          />
                          <span className="truncate max-w-[170px] text-[11px]">{p.client}</span>
                        </td>
                        <td className="py-1 px-2">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 border ${
                            isLight
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-[#071626] text-slate-300 border-slate-700'
                          }`}>
                            {p.solution}
                          </span>
                        </td>
                        <td className={`py-1 px-2 text-right font-mono font-bold text-[11px] ${
                          isLight ? 'text-red-600' : 'text-[#FF3366]'
                        }`}>
                          {p.marginPercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      </ContainerSlot>

      {/* ========================================================================= */}
      {/* 2. ADERÊNCIA AOS CRONOGRAMAS E ATRASOS                                    */}
      {/* 25% Quadrado com gráfico de arco preenchido + 75% Tabela                  */}
      {/* ========================================================================= */}
      <ContainerSlot id="pontos_atencao__cronogramas" layout={containerLayout} isPmo={isPmo}>
      <div className={`p-2.5 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0A1C30] border-[#16385C] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide mb-2 pb-1 border-b ${
          isLight ? 'text-slate-900 border-slate-200' : 'text-white border-slate-800'
        }`}>
          <span>Aderência aos cronogramas e atrasos</span>
          {/* Atraso médio subindo é ruim — daí higherIsBetter=false. */}
          {delayDelta
            ? <MoMBadge
                delta={delayDelta}
                text={formatDeltaPp(delayDelta)}
                higherIsBetter={false}
                theme={theme}
                suffix="de atraso vs mês ant."
              />
            : isPortfolioWide && <MoMEmpty theme={theme} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-stretch">
          {/* Left 25% - Quadrado com gráfico de arco contínuo (apenas preenchimento, sem ponteiro, sem glow) */}
          <div className={`lg:col-span-1 border p-2.5 flex flex-col items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#071626] border-[#1E436E]'
          }`}>
            <div className={`text-[10px] font-bold uppercase tracking-wider text-center ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Média de Aderência
            </div>

            {/* Downward-opening arc with fluid blended gradient, fill-only progress, no pointer, no glow */}
            <div className="relative w-full max-w-[200px] h-28 flex flex-col items-center justify-center select-none pt-1">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 160 95">
                <defs>
                  {/* Fluidly blended gradient: Red -> Orange -> Yellow -> Green -> Emerald */}
                  <linearGradient id="adherenceSmoothGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#EF4444" />
                    <stop offset="35%" stopColor="#F97316" />
                    <stop offset="60%" stopColor="#EAB308" />
                    <stop offset="85%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#00FF88" />
                  </linearGradient>
                </defs>

                {/* Subtle background arc track */}
                <path
                  d="M 25 78 A 55 55 0 0 1 135 78"
                  fill="none"
                  stroke={isLight ? '#E2E8F0' : '#132B47'}
                  strokeWidth="12"
                  strokeLinecap="round"
                />

                {/* Filled progress arc with smooth gradient (NO GLOW, NO POINTER) */}
                <path
                  d="M 25 78 A 55 55 0 0 1 135 78"
                  fill="none"
                  stroke="url(#adherenceSmoothGrad)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={ARC_LENGTH}
                  strokeDashoffset={strokeOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
                />

                {/* Central score and label, perfectly positioned */}
                <text
                  x="80"
                  y="62"
                  textAnchor="middle"
                  fill={isLight ? '#0F172A' : '#FFFFFF'}
                  fontSize="19"
                  fontWeight="900"
                  fontFamily="system-ui, sans-serif"
                >
                  {averageAdherence !== null ? `${averageAdherence.toFixed(1)}%` : '—'}
                </text>
                <text
                  x="80"
                  y="74"
                  textAnchor="middle"
                  fill={isLight ? '#64748B' : '#94A3B8'}
                  fontSize="7.5"
                  fontWeight="bold"
                  letterSpacing="0.5"
                >
                  ADERÊNCIA
                </text>

                {/* Bottom Min and Max boundary labels */}
                <text
                  x="25"
                  y="92"
                  textAnchor="middle"
                  fill={isLight ? '#64748B' : '#64748B'}
                  fontSize="9.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {gaugeMin.toFixed(0)}%
                </text>
                <text
                  x="135"
                  y="92"
                  textAnchor="middle"
                  fill={isLight ? '#64748B' : '#64748B'}
                  fontSize="9.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  100%
                </text>
              </svg>
            </div>
          </div>

          {/* Right 75% - Tabela "Projetos com atrasos registrados" */}
          <div className={`lg:col-span-3 border p-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#071626] border-[#1E436E]'
          }`}>
            <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              Projetos com atrasos registrados
            </div>

            {delayedProjects.length === 0 ? (
              <div className={`text-xs py-4 text-center italic border ${
                isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-[#0A1C30]/40 border-slate-800 text-[#00FF88]'
              }`}>
                Nenhum projeto com atraso registrado no período selecionado (100% no prazo).
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b text-[10px] font-bold uppercase ${
                      isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                    }`}>
                      <th className="py-1 px-2">Cliente</th>
                      <th className="py-1 px-2">Frente do projeto</th>
                      <th className="py-1 px-2 text-right">Atraso</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLight ? 'divide-slate-200/60' : 'divide-slate-800/60'}`}>
                    {delayedProjects.map(p => {
                      const delay = p.scheduleDelayPercent || 0;
                      const isHighDelay = delay >= 2.0;

                      return (
                        <tr key={p.id} className={isLight ? 'hover:bg-slate-100' : 'hover:bg-[#0E2847]'}>
                          <td className="py-1 px-2 flex items-center gap-1.5 font-medium">
                            <ClientLogo
                              clientName={p.client}
                              logoUrl={p.clientLogo}
                              size="xs"
                              theme={theme}
                            />
                            <span className="truncate max-w-[240px] text-[11px]">{p.client}</span>
                          </td>
                          <td className="py-1 px-2">
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 border ${
                              isLight
                                ? 'bg-white text-slate-700 border-slate-200'
                                : 'bg-[#0A1C30] text-slate-300 border-slate-700'
                            }`}>
                              {p.solution}
                            </span>
                          </td>
                          <td
                            className={`py-1 px-2 text-right font-mono font-bold text-[11px] ${
                              isHighDelay
                                ? isLight ? 'text-red-600' : 'text-[#FF3366]'
                                : isLight ? 'text-amber-600' : 'text-[#EAB308]'
                            }`}
                          >
                            {delay.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      </ContainerSlot>

      {/* ========================================================================= */}
      {/* 3. DOCUMENTAÇÃO REGISTRADA AO PMO E ASSINADA                              */}
      {/* ========================================================================= */}
      <ContainerSlot id="pontos_atencao__documentacao" layout={containerLayout} isPmo={isPmo}>
      <div className={`p-2.5 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0A1C30] border-[#16385C] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}>
        <div className={`text-xs font-bold uppercase tracking-wide mb-2 pb-1 border-b flex items-center justify-between ${
          isLight ? 'text-slate-900 border-slate-200' : 'text-white border-slate-800'
        }`}>
          <span>Documentação registrada ao PMO e assinada</span>
          {/* T7 — o valor do limite saiu da interface; a cor das barras continua
              usando esse limite internamente. */}
          {docsDelta
            ? <MoMBadge delta={docsDelta} text={formatDeltaPp(docsDelta)} theme={theme} />
            : isPortfolioWide && <MoMEmpty theme={theme} />}
        </div>

        {/* Horizontal bars grid */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {documentationList.map(item => {
            const hasPct = item.pct !== null;
            let barColor = 'bg-[#00FF88]';
            let textColor = isLight ? 'text-emerald-700' : 'text-[#00FF88]';

            if (hasPct && (item.pct as number) < governanceThreshold - 10) {
              barColor = 'bg-[#FF3366]';
              textColor = isLight ? 'text-red-600' : 'text-[#FF3366]';
            } else if (hasPct && (item.pct as number) < governanceThreshold) {
              barColor = 'bg-[#EAB308]';
              textColor = isLight ? 'text-amber-600' : 'text-[#EAB308]';
            }

            return (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-2 items-center text-xs py-0.5 px-1 transition-colors ${
                  isLight ? 'hover:bg-slate-50' : 'hover:bg-[#0E2847]/40'
                }`}
              >
                {/* Client and Solution */}
                <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 truncate">
                  <ClientLogo
                    clientName={item.client}
                    logoUrl={item.clientLogo}
                    size="xs"
                    theme={theme}
                  />
                  <span className={`font-semibold truncate text-[11px] ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                  }`}>
                    {item.client}
                  </span>
                  <span className={`text-[9px] px-1 py-0.2 shrink-0 border ${
                    isLight
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-[#071626] text-slate-400 border-slate-700'
                  }`}>
                    {item.solution}
                  </span>
                </div>

                {/* Bar or Legacy Text */}
                <div className="col-span-8 sm:col-span-9 flex items-center gap-2">
                  {!hasPct ? (
                    <span className={`text-[10px] font-semibold italic px-2 py-0.5 border ${
                      isLight
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : 'bg-[#071626] text-slate-400 border-slate-700/60'
                    }`}>
                      Sem dado de documentação na RSE
                    </span>
                  ) : item.isLegacy ? (
                    <span className={`text-[10px] font-semibold italic px-2 py-0.5 border ${
                      isLight
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : 'bg-[#071626] text-slate-400 border-slate-700/60'
                    }`}>
                      {containerSettings?.legacyNoticeText || 'Dados antigos não incluídos, controle interno agendado'}
                    </span>
                  ) : (
                    <>
                      <div className={`flex-1 h-3 border overflow-hidden relative ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#071626] border-slate-800'
                      }`}>
                        <div
                          style={{ width: `${Math.min(100, Math.max(0, item.pct as number))}%` }}
                          className={`h-full ${barColor} transition-all duration-300`}
                        />
                      </div>
                      <span className={`w-10 text-right font-mono font-bold text-[11px] ${textColor}`}>
                        {item.pct}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </ContainerSlot>
    </div>
  );
};
