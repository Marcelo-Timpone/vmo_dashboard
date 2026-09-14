import React, { useState, useMemo } from 'react';
import { SapProjectFinancial, AppTheme, ContainerParamSettings, ContainerLayoutConfig, MonthlyKpiSnapshot } from '../types';
import { formatCurrencyBRL } from '../utils/dateUtils';
import { FilterSolutionType } from './LateralControls';
import { ClientLogo } from './ClientLogo';
import { ContainerSlot } from './ContainerSlot';

interface OnePageDashboardProps {
  projects: SapProjectFinancial[];
  selectedFilters: FilterSolutionType[];
  theme?: AppTheme;
  containerSettings?: ContainerParamSettings;
  containerLayout?: ContainerLayoutConfig[];
  isPmo?: boolean;
  monthlyHistory?: MonthlyKpiSnapshot[];
}

export const OnePageDashboard: React.FC<OnePageDashboardProps> = ({
  projects,
  selectedFilters,
  theme = 'neon',
  containerSettings,
  containerLayout,
  isPmo = false,
  monthlyHistory = []
}) => {
  const isLight = theme === 'light';
  const [hoveredBurnupMonth, setHoveredBurnupMonth] = useState<number | null>(null);

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

  // Aggregates for Principais Informações
  const totalBilled = filteredProjects.reduce((acc, p) => acc + p.billed, 0);
  const uniqueClients = new Set(filteredProjects.map(p => p.client)).size;
  const totalGoLives = filteredProjects.length === 0 ? 0 : Math.max(1, Math.round(filteredProjects.length * 0.35));

  // Top 5 Clientes - Contribuição na Receita
  const topRevenueClients = useMemo(() => {
    const clientMap = new Map<string, { client: string; logoUrl?: string; solution: string; billed: number; count: number }>();
    filteredProjects.forEach(p => {
      const existing = clientMap.get(p.client) || { client: p.client, logoUrl: p.clientLogo, solution: p.solution, billed: 0, count: 0 };
      existing.billed += p.billed;
      existing.count += 1;
      if (!existing.logoUrl && p.clientLogo) existing.logoUrl = p.clientLogo;
      clientMap.set(p.client, existing);
    });
    return Array.from(clientMap.values())
      .sort((a, b) => b.billed - a.billed)
      .slice(0, 5);
  }, [filteredProjects]);

  // Top 5 Clientes - Contribuição na Margem
  const topMarginClients = useMemo(() => {
    const clientMap = new Map<string, { client: string; logoUrl?: string; solution: string; totalMargin: number; count: number }>();
    filteredProjects.forEach(p => {
      const existing = clientMap.get(p.client) || { client: p.client, logoUrl: p.clientLogo, solution: p.solution, totalMargin: 0, count: 0 };
      existing.totalMargin += p.marginPercent;
      existing.count += 1;
      if (!existing.logoUrl && p.clientLogo) existing.logoUrl = p.clientLogo;
      clientMap.set(p.client, existing);
    });
    return Array.from(clientMap.values())
      .map(c => ({
        client: c.client,
        logoUrl: c.logoUrl,
        solution: c.solution,
        margin: c.count > 0 ? (c.totalMargin / c.count).toFixed(1) : '0.0'
      }))
      .sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin))
      .slice(0, 5);
  }, [filteredProjects]);

  // Current weighted average margin
  const currentAvgMargin = useMemo(() => {
    if (filteredProjects.length === 0) return '24.0';
    const sum = filteredProjects.reduce((acc, p) => acc + p.marginPercent, 0);
    return (sum / filteredProjects.length).toFixed(1);
  }, [filteredProjects]);

  // Burnup Chart 12 Months Data (Annual Target vs Actual Accumulation)
  const annualTargetM = (containerSettings?.annualRevenueTarget ?? 120000000) / 1000000;
  const monthlyTargetStep = annualTargetM / 12;
  const monthsBase = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth(); // 0-11

  // Mapa mês (0-11) -> dado real daquele mês no ano atual, vindo da migração/histórico
  const historyByMonth = useMemo(() => {
    const map = new Map<number, MonthlyKpiSnapshot>();
    monthlyHistory
      .filter(h => h.year === currentYear)
      .forEach(h => map.set(h.month - 1, h));
    return map;
  }, [monthlyHistory, currentYear]);

  const burnupMonths = useMemo(() => {
    let cumulative = 0;
    let brokeChain = false;
    return monthsBase.map((m, idx) => {
      const targetAcc = Number((monthlyTargetStep * (idx + 1)).toFixed(1));
      const entry = historyByMonth.get(idx);
      let actualAcc: number | null = null;

      if (!brokeChain && entry) {
        cumulative += entry.revenueBilled / 1_000_000;
        actualAcc = Number(cumulative.toFixed(1));
      } else if (!entry) {
        // A partir do primeiro mês sem dado migrado, paramos o acumulado
        // (evita mostrar uma linha "real" com um buraco no meio).
        brokeChain = true;
      }

      return {
        month: m,
        targetAcc,
        actualAcc,
        hasData: !!entry,
        targetLabel: `R$ ${targetAcc.toFixed(1).replace('.', ',')}M`,
        actualLabel: actualAcc !== null ? `R$ ${actualAcc.toFixed(1).replace('.', ',')}M` : 'Sem dado migrado',
        current: idx === currentMonthIdx
      };
    });
  }, [monthlyTargetStep, historyByMonth]);

  // Escala Y do gráfico de burnup: 0 -> y=120 (piso), annualTargetM -> y=20 (topo)
  const burnupYFromValueM = (valueM: number) => Math.max(8, Math.min(128, 120 - (valueM / annualTargetM) * 100));
  const burnupPointsWithData = burnupMonths
    .map((m, idx) => ({ ...m, idx }))
    .filter(m => m.actualAcc !== null);
  const burnupPathD = burnupPointsWithData
    .map((m, i) => `${i === 0 ? 'M' : 'L'} ${50 + m.idx * 90} ${burnupYFromValueM(m.actualAcc as number)}`)
    .join(' ');

  // 12 Months Margin Data — usa dado real migrado quando existe; mês atual usa a
  // média calculada dos projetos ativos agora; meses futuros mostram a meta
  // (visualmente esmaecidos); meses passados sem migração ficam "sem dado".
  const MARGIN_TARGET = containerSettings?.contractMarginTarget ?? 24.0;
  const marginMonths = useMemo(() => {
    return monthsBase.map((m, idx) => {
      const isCurrent = idx === currentMonthIdx;
      const isFuture = idx > currentMonthIdx;
      const entry = historyByMonth.get(idx);

      let value: number | null = null;
      let hasData = false;
      if (isCurrent) {
        value = parseFloat(currentAvgMargin);
        hasData = true;
      } else if (entry) {
        value = entry.marginAvg;
        hasData = true;
      } else if (isFuture) {
        value = MARGIN_TARGET;
        hasData = false;
      }

      return { month: m, value, isCurrent, isFuture, hasData };
    });
  }, [historyByMonth, currentAvgMargin, currentMonthIdx, MARGIN_TARGET]);

  // Client monogram helper
  const getClientInitials = (name: string) => {
    return name
      .split(' ')
      .filter(w => w.length > 2)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  };

  // Mathematical baseline and bar height parameters for SVG margin chart
  // Coordinate space: viewBox="0 0 1000 145"
  // Floor y = 114. Max margin = 35.0%. Range = 82.
  const MARGIN_MAX = 35.0;
  const MARGIN_FLOOR_Y = 114;
  const MARGIN_SPAN_Y = 82;
  const targetBaselineY = MARGIN_FLOOR_Y - (MARGIN_TARGET / MARGIN_MAX) * MARGIN_SPAN_Y;

  return (
    <div className={`w-full flex flex-col gap-2 max-w-[1600px] mx-auto ${
      isLight ? 'text-slate-900' : 'text-slate-100'
    }`}>
      {/* ========================================================================= */}
      {/* 1. PRINCIPAIS INFORMAÇÕES - 4 CAIXAS NA HORIZONTAL                        */}
      {/* ========================================================================= */}
      <ContainerSlot id="one_page__principais_informacoes" layout={containerLayout} isPmo={isPmo}>
      <div className={`p-2.5 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0A1C30] border-[#16385C] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}>
        <div className={`text-xs font-bold uppercase tracking-wide mb-2 pb-1 border-b ${
          isLight ? 'text-slate-900 border-slate-200' : 'text-white border-slate-800'
        }`}>
          Principais informações
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Card 1: FATURAMENTO TOTAL - Verde */}
          <div className={`p-2 flex flex-col justify-between border transition-colors ${
            isLight
              ? 'bg-slate-50 border-slate-200 hover:border-emerald-500'
              : 'bg-[#071626] border-[#16385C] hover:border-[#00FF88]/50'
          }`}>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-[10px] font-extrabold tracking-wider uppercase ${
                isLight ? 'text-emerald-700' : 'text-[#00FF88]'
              }`}>
                FATURAMENTO TOTAL
              </span>
              <span className={`text-[9px] font-semibold px-1 py-0.2 border ${
                isLight
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
              }`}>
                +8.4% vs mês ant.
              </span>
            </div>
            <div className={`text-lg sm:text-xl font-black tracking-tight my-0.5 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {formatCurrencyBRL(totalBilled || 9850000)}
            </div>
            {/* Sparkline Line Chart Verde */}
            <div className="h-5 w-full pt-0.5">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 200 30">
                <defs>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00FF88" stopOpacity={isLight ? '0.15' : '0.3'} />
                    <stop offset="100%" stopColor="#00FF88" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <polygon points="0,22 30,20 65,14 100,16 135,10 170,8 200,4 200,30 0,30" fill="url(#gradGreen)" />
                <polyline
                  fill="none"
                  stroke={isLight ? '#059669' : '#00FF88'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  points="0,22 30,20 65,14 100,16 135,10 170,8 200,4"
                />
                <circle cx="200" cy="4" r="2.5" fill={isLight ? '#059669' : '#00FF88'} />
              </svg>
            </div>
          </div>

          {/* Card 2: GASTO TOTAL - Verde quando cai (lógica de redução de custos favorável) */}
          <div className={`p-2 flex flex-col justify-between border transition-colors ${
            isLight
              ? 'bg-slate-50 border-slate-200 hover:border-emerald-500'
              : 'bg-[#071626] border-[#16385C] hover:border-[#00FF88]/50'
          }`}>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-[10px] font-extrabold tracking-wider uppercase ${
                isLight ? 'text-slate-700' : 'text-slate-300'
              }`}>
                GASTO TOTAL
              </span>
              {/* Quando o gasto cai (-3.2%), é favorável e fica verde */}
              <span className={`text-[9px] font-semibold px-1 py-0.2 border ${
                isLight
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
              }`}>
                -3.2% vs mês ant.
              </span>
            </div>
            <div className={`text-lg sm:text-xl font-black tracking-tight my-0.5 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              R$ 10.265.000
            </div>
            {/* Sparkline Line Chart: gasto em queda com indicador verde */}
            <div className="h-5 w-full pt-0.5">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 200 30">
                <defs>
                  <linearGradient id="gradSpendGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00FF88" stopOpacity={isLight ? '0.15' : '0.25'} />
                    <stop offset="100%" stopColor="#00FF88" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <polygon points="0,8 30,12 65,10 100,18 135,15 170,22 200,20 200,30 0,30" fill="url(#gradSpendGreen)" />
                <polyline
                  fill="none"
                  stroke={isLight ? '#059669' : '#00FF88'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  points="0,8 30,12 65,10 100,18 135,15 170,22 200,20"
                />
                <circle cx="200" cy="20" r="2.5" fill={isLight ? '#059669' : '#00FF88'} />
              </svg>
            </div>
          </div>

          {/* Card 3: Total de clientes atendidos - Azul */}
          <div className={`p-2 flex flex-col justify-between border transition-colors ${
            isLight
              ? 'bg-slate-50 border-slate-200 hover:border-blue-500'
              : 'bg-[#071626] border-[#16385C] hover:border-[#00D2FF]/50'
          }`}>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-[10px] font-extrabold tracking-wider uppercase ${
                isLight ? 'text-blue-700' : 'text-[#00D2FF]'
              }`}>
                Total de clientes atendidos
              </span>
              <span className={`text-[9px] font-semibold px-1 py-0.2 border ${
                isLight
                  ? 'text-blue-700 bg-blue-50 border-blue-200'
                  : 'text-[#00D2FF] bg-[#00D2FF]/10 border-[#00D2FF]/30'
              }`}>
                +2 novos
              </span>
            </div>
            <div className={`text-lg sm:text-xl font-black tracking-tight my-0.5 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {uniqueClients} <span className="text-xs font-normal text-slate-400">empresas</span>
            </div>
            {/* Sparkline Azul */}
            <div className="h-5 w-full pt-0.5">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 200 30">
                <defs>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D2FF" stopOpacity={isLight ? '0.15' : '0.3'} />
                    <stop offset="100%" stopColor="#00D2FF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <polygon points="0,24 35,20 70,18 105,14 140,11 175,8 200,6 200,30 0,30" fill="url(#gradBlue)" />
                <polyline
                  fill="none"
                  stroke={isLight ? '#0284C7' : '#00D2FF'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  points="0,24 35,20 70,18 105,14 140,11 175,8 200,6"
                />
                <circle cx="200" cy="6" r="2.5" fill={isLight ? '#0284C7' : '#00D2FF'} />
              </svg>
            </div>
          </div>

          {/* Card 4: Total de Go-Lives no mês - Laranja */}
          <div className={`p-2 flex flex-col justify-between border transition-colors ${
            isLight
              ? 'bg-slate-50 border-slate-200 hover:border-orange-500'
              : 'bg-[#071626] border-[#16385C] hover:border-[#F26522]/50'
          }`}>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-[10px] font-extrabold tracking-wider uppercase ${
                isLight ? 'text-[#F26522]' : 'text-[#F26522]'
              }`}>
                Total de Go-Lives no mês
              </span>
              <span className={`text-[9px] font-semibold px-1 py-0.2 border ${
                isLight
                  ? 'text-[#F26522] bg-orange-50 border-orange-200'
                  : 'text-[#F26522] bg-[#F26522]/10 border-[#F26522]/30'
              }`}>
                +1 vs mês ant.
              </span>
            </div>
            <div className={`text-lg sm:text-xl font-black tracking-tight my-0.5 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {totalGoLives} <span className="text-xs font-normal text-slate-400">projetos ativados</span>
            </div>
            {/* Sparkline Laranja */}
            <div className="h-5 w-full pt-0.5">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 200 30">
                <defs>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F26522" stopOpacity={isLight ? '0.15' : '0.3'} />
                    <stop offset="100%" stopColor="#F26522" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <polygon points="0,26 30,22 65,24 100,16 135,13 170,8 200,4 200,30 0,30" fill="url(#gradOrange)" />
                <polyline
                  fill="none"
                  stroke="#F26522"
                  strokeWidth="2"
                  strokeLinecap="round"
                  points="0,26 30,22 65,24 100,16 135,13 170,8 200,4"
                />
                <circle cx="200" cy="4" r="2.5" fill="#F26522" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      </ContainerSlot>

      {/* ========================================================================= */}
      {/* 2. META DE RECEITA - BURNUP CHART (ESTÁTICO, SEM ANIMAÇÃO CONFORME PEDIDO) */}
      {/* ========================================================================= */}
      <ContainerSlot id="one_page__meta_receita" layout={containerLayout} isPmo={isPmo}>
      <div className={`p-2.5 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0A1C30] border-[#16385C] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}>
        <div className={`flex items-center justify-between gap-2 mb-1.5 pb-1 border-b ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <span className={`text-xs font-bold uppercase tracking-wide ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            Meta de receita
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-b border-dashed border-slate-400"></span>
              <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>Linha Base Meta (R$ {annualTargetM.toFixed(0)}M)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-3 h-1 ${isLight ? 'bg-emerald-600' : 'bg-[#00FF88]'}`}></span>
              <span className={`font-semibold ${isLight ? 'text-emerald-700' : 'text-[#00FF88]'}`}>
                Faturamento Real Acumulado
              </span>
            </div>
          </div>
        </div>

        {/* Burnup SVG Stage (STATIC: sem animações) */}
        <div className="relative w-full h-28 sm:h-32 select-none">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 1100 150" preserveAspectRatio="none">
            {/* Grid horizontal guide lines */}
            {[30, 60, 90, 120].map(y => (
              <line
                key={y}
                x1="40"
                y1={y}
                x2="1060"
                y2={y}
                stroke={isLight ? '#E2E8F0' : '#132B47'}
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Vertical month guide lines */}
            {burnupMonths.map((m, idx) => {
              const x = 50 + idx * 90;
              return (
                <line
                  key={m.month}
                  x1={x}
                  y1="15"
                  x2={x}
                  y2="128"
                  stroke={m.current ? '#F26522' : isLight ? '#E2E8F0' : '#10253D'}
                  strokeWidth={m.current ? '1.5' : '1'}
                  strokeDasharray={m.current ? '2 2' : 'none'}
                />
              );
            })}

            {/* Target Baseline: diagonal from Jan (10M) to Dez (120M) */}
            <line
              x1="50"
              y1="120"
              x2="1040"
              y2="20"
              stroke={isLight ? '#94A3B8' : '#64748B'}
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />

            {/* Actual Realized Revenue Path (calculado a partir do histórico real migrado) */}
            {burnupPathD && (
              <path
                d={burnupPathD}
                fill="none"
                stroke={isLight ? '#059669' : '#00FF88'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Month Data Points on Real Line (posição calculada a partir do dado real) */}
            {burnupPointsWithData.map(m => {
                const x = 50 + m.idx * 90;
                const y = burnupYFromValueM(m.actualAcc as number);
                const isCurrent = !!m.current;

                return (
                  <g
                    key={m.month}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredBurnupMonth(m.idx)}
                    onMouseLeave={() => setHoveredBurnupMonth(null)}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={isCurrent ? '4.5' : '3.5'}
                      fill={isCurrent ? '#F26522' : isLight ? '#059669' : '#00FF88'}
                      stroke={isLight ? '#FFFFFF' : '#06121E'}
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}

            {/* Month labels at bottom */}
            {burnupMonths.map((m, idx) => {
              const x = 50 + idx * 90;
              const isCurrent = !!m.current;
              return (
                <text
                  key={m.month}
                  x={x}
                  y="144"
                  textAnchor="middle"
                  className={`text-[10px] font-bold ${
                    isCurrent
                      ? 'fill-[#F26522]'
                      : m.actualAcc !== null
                      ? isLight ? 'fill-slate-700' : 'fill-slate-300'
                      : isLight ? 'fill-slate-400' : 'fill-slate-600'
                  }`}
                >
                  {m.month}
                </text>
              );
            })}
          </svg>

          {/* Hover Tooltip display */}
          {hoveredBurnupMonth !== null && (
            <div
              className={`absolute -top-1 px-2.5 py-1 text-xs shadow-xl pointer-events-none transition-all z-20 border ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-800'
                  : 'bg-[#06121E] border-[#00FF88] text-white'
              }`}
              style={{
                left: `${Math.min(85, Math.max(5, (hoveredBurnupMonth / 11) * 100))}%`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="font-bold text-[10px] mb-0.5">
                {burnupMonths[hoveredBurnupMonth].month}/{currentYear} {burnupMonths[hoveredBurnupMonth].current ? '(Mês Atual)' : ''}
              </div>
              <div className={`font-bold text-[10px] ${isLight ? 'text-emerald-700' : 'text-[#00FF88]'}`}>
                Real: {burnupMonths[hoveredBurnupMonth].actualLabel}
              </div>
              <div className="text-slate-400 text-[9px]">
                Meta: {burnupMonths[hoveredBurnupMonth].targetLabel}
              </div>
            </div>
          )}
        </div>
      </div>
      </ContainerSlot>

      {/* ========================================================================= */}
      {/* 3. META DE MARGEM - 25% QUADRADO META ATUAL + 75% GRÁFICO DE COLUNAS       */}
      {/* ========================================================================= */}
      <ContainerSlot id="one_page__meta_margem" layout={containerLayout} isPmo={isPmo}>
      <div className={`p-2.5 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0A1C30] border-[#16385C] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}>
        <div className={`text-xs font-bold uppercase tracking-wide mb-2 pb-1 border-b ${
          isLight ? 'text-slate-900 border-slate-200' : 'text-white border-slate-800'
        }`}>
          Meta de margem
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5 items-stretch">
          {/* Left 25% - Quadrado mostrando a meta atual */}
          <div className={`lg:col-span-1 p-2.5 flex flex-col justify-between border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#071626] border-[#1E436E]'
          }`}>
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}>
                META DE MARGEM
              </div>
              <div className={`text-2xl font-black tracking-tight ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                {MARGIN_TARGET.toFixed(1)}%
              </div>
            </div>

            <div className={`pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Mês Atual ({monthsBase[currentMonthIdx]})
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-black ${isLight ? 'text-emerald-700' : 'text-[#00FF88]'}`}>
                  {currentAvgMargin}%
                </span>
                <span className={`text-[9px] font-bold px-1 py-0.2 border ${
                  isLight
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
                }`}>
                  +{(parseFloat(currentAvgMargin) - MARGIN_TARGET).toFixed(1)} p.p.
                </span>
              </div>
            </div>
          </div>

          {/* Right 75% - Gráfico de colunas com layout e espaçamento ajustados para evitar sobreposição */}
          <div className={`lg:col-span-3 p-2 flex flex-col justify-between border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#071626] border-[#1E436E]'
          }`}>
            <div className="relative w-full h-32 sm:h-36 select-none">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 145" preserveAspectRatio="none">
                {/* Baseline line at EXACT 24.0% height (rendered behind all bars and labels) */}
                <line
                  x1="35"
                  y1={targetBaselineY}
                  x2="975"
                  y2={targetBaselineY}
                  stroke={isLight ? '#0284C7' : '#00D2FF'}
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                  opacity="0.8"
                />

                {/* 12 Month Columns with ample spacing and adjusted label heights */}
                {marginMonths.map((m, idx) => {
                  const colWidth = 28;
                  const colSpacing = 77;
                  const x = 50 + idx * colSpacing;
                  const isCurrent = !!m.isCurrent;
                  const isFuture = !!m.isFuture;

                  if (m.value === null) {
                    // Mês passado sem dado migrado ainda: sem barra, só um indicador discreto
                    return (
                      <g key={m.month}>
                        <line
                          x1={x}
                          y1={MARGIN_FLOOR_Y}
                          x2={x + colWidth}
                          y2={MARGIN_FLOOR_Y}
                          stroke={isLight ? '#CBD5E1' : '#334155'}
                          strokeWidth="2"
                          strokeDasharray="3 2"
                        />
                        <text
                          x={x + colWidth / 2}
                          y={MARGIN_FLOOR_Y - 6}
                          textAnchor="middle"
                          fill={isLight ? '#94A3B8' : '#475569'}
                          fontSize="7.5"
                          fontStyle="italic"
                        >
                          s/ dado
                        </text>
                        <text
                          x={x + colWidth / 2}
                          y="128"
                          textAnchor="middle"
                          fill={isLight ? '#94A3B8' : '#475569'}
                          fontSize="10"
                        >
                          {m.month}
                        </text>
                      </g>
                    );
                  }

                  const barHeight = (m.value / MARGIN_MAX) * MARGIN_SPAN_Y;
                  const barY = MARGIN_FLOOR_Y - barHeight;
                  const exceedsTarget = m.value >= MARGIN_TARGET;
                  const isBelowAverage = !exceedsTarget;

                  const barFill = isLight
                    ? exceedsTarget
                      ? '#059669'
                      : '#DC2626'
                    : exceedsTarget
                    ? '#00FF88'
                    : '#FF3366';

                  // When below average, percentage is placed INSIDE the bar; otherwise above the bar
                  const textY = isBelowAverage ? barY + 11 : barY - 5;
                  const textColor = isBelowAverage
                    ? '#FFFFFF'
                    : isCurrent
                    ? isLight ? '#059669' : '#00FF88'
                    : isLight ? '#475569' : '#94A3B8';

                  return (
                    <g key={m.month}>
                      {/* Column Bar */}
                      <rect
                        x={x}
                        y={barY}
                        width={colWidth}
                        height={barHeight}
                        fill={barFill}
                        opacity={isFuture ? 0.35 : 1.0}
                      />

                      {/* Current Month Highlight Outline */}
                      {isCurrent && (
                        <rect
                          x={x - 1.5}
                          y={barY - 1.5}
                          width={colWidth + 3}
                          height={barHeight + 3}
                          fill="none"
                          stroke={isLight ? '#0F172A' : '#FFFFFF'}
                          strokeWidth="1.5"
                        />
                      )}

                      {/* Value label placed inside the bar if below average, above if above average */}
                      <text
                        x={x + colWidth / 2}
                        y={textY}
                        textAnchor="middle"
                        fill={textColor}
                        fontSize={isBelowAverage ? '8.5' : '9'}
                        fontFamily="monospace"
                        fontWeight={isBelowAverage || isCurrent ? 'bold' : 'normal'}
                      >
                        {m.value.toFixed(1)}%
                      </text>

                      {/* Month label below floor */}
                      <text
                        x={x + colWidth / 2}
                        y="128"
                        textAnchor="middle"
                        fill={
                          isCurrent
                            ? '#F26522'
                            : isFuture
                            ? isLight ? '#94A3B8' : '#475569'
                            : isLight ? '#334155' : '#CBD5E1'
                        }
                        fontSize="10"
                        fontWeight={isCurrent ? 'bold' : 'normal'}
                      >
                        {m.month}
                      </text>

                      {/* Mês Atual indicator badge under month */}
                      {isCurrent && (
                        <text
                          x={x + colWidth / 2}
                          y="139"
                          textAnchor="middle"
                          fill="#F26522"
                          fontSize="7"
                          fontWeight="bold"
                        >
                          MÊS
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
      </ContainerSlot>

      {/* ========================================================================= */}
      {/* 4. CONTRIBUIÇÕES PARA AS METAS - TABELAS DIVIDIDAS NO PONTO VERTICAL       */}
      {/* ========================================================================= */}
      <ContainerSlot id="one_page__contribuicoes_metas" layout={containerLayout} isPmo={isPmo}>
      <div className={`p-2.5 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0A1C30] border-[#16385C] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}>
        <div className={`text-xs font-bold uppercase tracking-wide mb-1.5 pb-1 border-b ${
          isLight ? 'text-slate-900 border-slate-200' : 'text-white border-slate-800'
        }`}>
          Contribuições para as metas
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x gap-y-2 lg:gap-y-0 ${
          isLight ? 'divide-slate-200' : 'divide-slate-800'
        }`}>
          {/* Tabela 1: Clientes com maior contribuição na receita (Top 5) */}
          <div className="lg:pr-3">
            <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              Clientes com maior contribuição na receita
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b text-[10px] font-bold uppercase ${
                    isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                  }`}>
                    <th className="py-1 px-2">Cliente</th>
                    <th className="py-1 px-2">Frente</th>
                    <th className="py-1 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                  {topRevenueClients.map(c => (
                    <tr key={c.client} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-[#0E2847]'}>
                      <td className="py-1 px-2 flex items-center gap-1.5 font-medium">
                        <ClientLogo
                          clientName={c.client}
                          logoUrl={c.logoUrl}
                          size="xs"
                          theme={theme}
                        />
                        <span className="truncate max-w-[170px] text-[11px]">{c.client}</span>
                      </td>
                      <td className="py-1 px-2">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 border ${
                          isLight
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-[#071626] text-slate-300 border-slate-700'
                        }`}>
                          {c.solution}
                        </span>
                      </td>
                      <td className={`py-1 px-2 text-right font-mono font-bold text-[11px] ${
                        isLight ? 'text-emerald-700' : 'text-[#00FF88]'
                      }`}>
                        {formatCurrencyBRL(c.billed)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela 2: Clientes com maior contribuição na margem (Top 5) */}
          <div className="lg:pl-3">
            <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              Clientes com maior contribuição na margem
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b text-[10px] font-bold uppercase ${
                    isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                  }`}>
                    <th className="py-1 px-2">Cliente</th>
                    <th className="py-1 px-2">Frente</th>
                    <th className="py-1 px-2 text-right">Margem</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                  {topMarginClients.map(c => (
                    <tr key={c.client} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-[#0E2847]'}>
                      <td className="py-1 px-2 flex items-center gap-1.5 font-medium">
                        <ClientLogo
                          clientName={c.client}
                          logoUrl={c.logoUrl}
                          size="xs"
                          theme={theme}
                        />
                        <span className="truncate max-w-[170px] text-[11px]">{c.client}</span>
                      </td>
                      <td className="py-1 px-2">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 border ${
                          isLight
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-[#071626] text-slate-300 border-slate-700'
                        }`}>
                          {c.solution}
                        </span>
                      </td>
                      <td className={`py-1 px-2 text-right font-mono font-bold text-[11px] ${
                        isLight ? 'text-emerald-700' : 'text-[#00FF88]'
                      }`}>
                        {c.margin}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </ContainerSlot>
    </div>
  );
};
