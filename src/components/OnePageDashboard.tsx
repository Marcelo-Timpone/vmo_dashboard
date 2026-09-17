import React, { useState, useMemo } from 'react';
import {
  SapProjectFinancial,
  AppTheme,
  ContainerParamSettings,
  ContainerLayoutConfig,
  MonthlyKpiSnapshot,
  VmoReferencePeriod
} from '../types';
import { formatCurrencyBRL } from '../utils/dateUtils';
import { FilterSolutionType } from './LateralControls';
import { useCatalogo } from '../context/CatalogoContext';
import { filtrarProjetosPorPortfolio } from '../utils/portfolio';
import { ClientLogo } from './ClientLogo';
import { ContainerSlot } from './ContainerSlot';
import { MoMBadge, MoMEmpty } from './MoMBadge';
import { MonthlyKpiDetailModal, KpiMetricDefinition } from './MonthlyKpiDetailModal';
import {
  MonthlyMetricKey,
  buildMonthlySeries,
  buildSparkline,
  computeDelta,
  metricForMonth,
  formatDeltaPercent,
  formatDeltaAbs,
  formatDeltaPp,
  MONTH_ABBR,
  MONTH_FULL,
  latestHistoryMonth
} from '../utils/monthlyComparison';

interface OnePageDashboardProps {
  projects: SapProjectFinancial[];
  referencePeriod?: VmoReferencePeriod;
  selectedFilters: FilterSolutionType[];
  theme?: AppTheme;
  containerSettings?: ContainerParamSettings;
  containerLayout?: ContainerLayoutConfig[];
  isPmo?: boolean;
  monthlyHistory?: MonthlyKpiSnapshot[];
}

export const OnePageDashboard: React.FC<OnePageDashboardProps> = ({
  projects,
  referencePeriod,
  selectedFilters,
  theme = 'neon',
  containerSettings,
  containerLayout,
  isPmo = false,
  monthlyHistory = []
}) => {
  const rot = useCatalogo();
  // `isLight` / tema claro: mantido como código morto (ver T9 — tema fixo Neon).
  const isLight = theme === 'light';
  const [hoveredBurnupMonth, setHoveredBurnupMonth] = useState<number | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<KpiMetricDefinition | null>(null);

  // Filtra por frente e solução (itens do mesmo grupo somam; grupos se cruzam)
  const filteredProjects = useMemo(
    () => filtrarProjetosPorPortfolio(projects, selectedFilters, rot.catalogo),
    [projects, selectedFilters, rot.catalogo]
  );

  // ---------------------------------------------------------------------------
  // O histórico mensal é AGREGADO DO PORTFÓLIO INTEIRO — não tem dimensão de
  // solução. Com um filtro de frente ativo, comparar o cartão filtrado contra o
  // histórico não-filtrado produziria um número errado. Então, sob filtro, os
  // comparativos e sparklines são suprimidos e o cartão fica só com o valor.
  // ---------------------------------------------------------------------------
  const isPortfolioWide = selectedFilters.includes('TODOS') || selectedFilters.length === 0;

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth(); // 0-11

  // ---------------------------------------------------------------------------
  // MÊS DE REFERÊNCIA DOS CARTÕES
  // A referência é o mês analisado do período configurado em Configurações. Sem
  // histórico dele, vale o último mês fechado (meses parciais ficam de fora). O chip no cabeçalho diz qual é, para não restar dúvida
  // sobre a que período os quatro números se referem.
  // ---------------------------------------------------------------------------
  const referenceMonth = useMemo(() => {
    const ref = latestHistoryMonth(monthlyHistory, referencePeriod);
    if (ref) return { year: ref.year, month: ref.month, parcial: ref.parcial };
    return { year: currentYear, month: currentMonthIdx + 1, parcial: false };
  }, [monthlyHistory, referencePeriod, currentYear, currentMonthIdx]);

  const hasHistory = monthlyHistory.length > 0;

  // Aggregates ao vivo (estado atual dos projetos) — usados nos contêineres que
  // não são "do mês": tabelas de contribuição, margem do mês corrente, etc.
  const totalBilled = filteredProjects.reduce((acc, p) => acc + (p.billed || 0), 0);
  const uniqueClients = new Set(filteredProjects.map(p => p.client)).size;

  // ---------------------------------------------------------------------------
  // T2/T3 — CARTÕES COM DADO REAL
  // Cada cartão lê um campo de MonthlyKpiSnapshot no mês de referência. Sem
  // dado: o cartão mostra "—", sem sparkline e sem badge. Nunca há curva de
  // enfeite nem variação estimada.
  // ---------------------------------------------------------------------------
  const buildCard = (
    metric: MonthlyMetricKey,
    options: { higherIsBetter?: boolean } = {}
  ) => {
    const value = metricForMonth(monthlyHistory, metric, referenceMonth.year, referenceMonth.month);
    const series = buildMonthlySeries(monthlyHistory, metric, referenceMonth.year, referenceMonth.month, 7);
    const delta = isPortfolioWide
      ? computeDelta(monthlyHistory, metric, referenceMonth.year, referenceMonth.month)
      : null;
    const sparkline = isPortfolioWide ? buildSparkline(series) : null;
    return { value, series, delta, sparkline, higherIsBetter: options.higherIsBetter !== false };
  };

  const cardRevenue = buildCard('revenueBilled');
  const cardSpend = buildCard('totalSpend', { higherIsBetter: false });
  const cardClients = buildCard('clientsServed');
  const cardGoLives = buildCard('goLivesCompleted');

  // Definições usadas pelo modal de expansão (T5) — mesmos campos dos cartões.
  const METRIC_REVENUE: KpiMetricDefinition = {
    key: 'revenueBilled',
    label: 'Faturamento do mês',
    format: v => formatCurrencyBRL(Math.round(v)),
    color: isLight ? '#059669' : '#00FF88',
    higherIsBetter: true,
    chartStyle: 'line'
  };
  const METRIC_SPEND: KpiMetricDefinition = {
    key: 'totalSpend',
    label: 'Gasto total do mês',
    format: v => formatCurrencyBRL(Math.round(v)),
    color: isLight ? '#0284C7' : '#00D2FF',
    higherIsBetter: false,
    chartStyle: 'line'
  };
  const METRIC_CLIENTS: KpiMetricDefinition = {
    key: 'clientsServed',
    label: 'Clientes atendidos',
    format: v => `${Math.round(v)}`,
    color: isLight ? '#0284C7' : '#00D2FF',
    higherIsBetter: true,
    chartStyle: 'bar'
  };
  const METRIC_GOLIVES: KpiMetricDefinition = {
    key: 'goLivesCompleted',
    label: 'Go-lives concluídos',
    format: v => `${Math.round(v)}`,
    color: 'var(--exed-accent)',
    higherIsBetter: true,
    chartStyle: 'bar'
  };

  // Top 5 Clientes - Contribuição na Receita
  const topRevenueClients = useMemo(() => {
    const clientMap = new Map<string, { client: string; logoUrl?: string; solution: string; billed: number; count: number }>();
    filteredProjects.forEach(p => {
      const existing = clientMap.get(p.client) || { client: p.client, logoUrl: p.clientLogo, solution: p.solution, billed: 0, count: 0 };
      existing.billed += p.billed || 0;
      existing.count += 1;
      if (!existing.logoUrl && p.clientLogo) existing.logoUrl = p.clientLogo;
      clientMap.set(p.client, existing);
    });
    return Array.from(clientMap.values())
      .sort((a, b) => b.billed - a.billed)
      .slice(0, containerSettings?.topClientsLimit ?? 5);
  }, [filteredProjects, containerSettings]);

  // Top 5 Clientes - Contribuição na Margem
  const topMarginClients = useMemo(() => {
    const clientMap = new Map<string, { client: string; logoUrl?: string; solution: string; totalMargin: number; count: number }>();
    filteredProjects.forEach(p => {
      const existing = clientMap.get(p.client) || { client: p.client, logoUrl: p.clientLogo, solution: p.solution, totalMargin: 0, count: 0 };
      // Projeto sem margem (ex.: receita com erro na RSE) não entra na média.
      if (typeof p.marginPercent === 'number' && Number.isFinite(p.marginPercent)) {
        existing.totalMargin += p.marginPercent;
        existing.count += 1;
      }
      if (!existing.logoUrl && p.clientLogo) existing.logoUrl = p.clientLogo;
      clientMap.set(p.client, existing);
    });
    return Array.from(clientMap.values())
      .filter(c => c.count > 0)
      .map(c => ({
        client: c.client,
        logoUrl: c.logoUrl,
        solution: c.solution,
        margin: c.count > 0 ? (c.totalMargin / c.count).toFixed(1) : '0.0'
      }))
      .sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin))
      .slice(0, containerSettings?.topClientsLimit ?? 5);
  }, [filteredProjects, containerSettings]);

  // Margem média ponderada do estado atual dos projetos (mês corrente em curso)
  const currentAvgMargin = useMemo(() => {
    if (filteredProjects.length === 0) return null;
    const comMargem = filteredProjects.filter(p => typeof p.marginPercent === 'number' && Number.isFinite(p.marginPercent));
    if (comMargem.length === 0) return null;
    const sum = comMargem.reduce((acc, p) => acc + p.marginPercent, 0);
    return sum / comMargem.length;
  }, [filteredProjects]);

  // ---------------------------------------------------------------------------
  // T7 — METAS OPCIONAIS
  // Sem meta configurada, a linha de meta NÃO é desenhada (antes o app caía num
  // default de R$ 120 milhões que ninguém tinha configurado e que aparecia como
  // se fosse uma meta real da empresa).
  // ---------------------------------------------------------------------------
  const rawRevenueTarget = containerSettings?.annualRevenueTarget;
  const hasRevenueTarget = typeof rawRevenueTarget === 'number' && Number.isFinite(rawRevenueTarget) && rawRevenueTarget > 0;
  const annualTargetM = hasRevenueTarget ? (rawRevenueTarget as number) / 1000000 : null;

  const rawMarginTarget = containerSettings?.contractMarginTarget;
  const hasMarginTarget = typeof rawMarginTarget === 'number' && Number.isFinite(rawMarginTarget) && rawMarginTarget > 0;
  const MARGIN_TARGET = hasMarginTarget ? (rawMarginTarget as number) : null;

  const monthsBase = MONTH_ABBR;

  // Mapa mês (0-11) -> dado real daquele mês no ano atual, vindo da migração
  const historyByMonth = useMemo(() => {
    const map = new Map<number, MonthlyKpiSnapshot>();
    monthlyHistory
      .filter(h => h.year === currentYear)
      .forEach(h => map.set(h.month - 1, h));
    return map;
  }, [monthlyHistory, currentYear]);

  // Primeiro mês do ano com histórico: o acumulado começa nele, porque a
  // migração pode começar no meio do ano. Um buraco DEPOIS dele interrompe a linha.
  const firstBurnupIdx = useMemo(() => {
    for (let i = 0; i < 12; i++) {
      if (historyByMonth.has(i)) return i;
    }
    return null;
  }, [historyByMonth]);

  const burnupMonths = useMemo(() => {
    let cumulative = 0;
    let brokeChain = false;
    return monthsBase.map((m, idx) => {
      const targetAcc = annualTargetM !== null ? Number(((annualTargetM / 12) * (idx + 1)).toFixed(1)) : null;
      const entry = historyByMonth.get(idx);
      let actualAcc: number | null = null;

      const antesDoInicio = firstBurnupIdx === null || idx < firstBurnupIdx;
      if (!antesDoInicio && !brokeChain && entry) {
        cumulative += (entry.revenueBilled || 0) / 1_000_000;
        actualAcc = Number(cumulative.toFixed(1));
      } else if (!antesDoInicio && !entry) {
        // Buraco depois do início: a linha para (não desenha real com lacuna).
        brokeChain = true;
      }

      return {
        month: m,
        targetAcc,
        actualAcc,
        hasData: !!entry,
        targetLabel: targetAcc !== null ? `R$ ${targetAcc.toFixed(1).replace('.', ',')}M` : null,
        actualLabel: actualAcc !== null ? `R$ ${actualAcc.toFixed(1).replace('.', ',')}M` : 'Sem dado migrado',
        current: idx === currentMonthIdx
      };
    });
  }, [annualTargetM, historyByMonth, currentMonthIdx, monthsBase, firstBurnupIdx]);

  // Escala Y do burnup: com meta, o topo é a meta anual (como antes). Sem meta,
  // o topo vem do próprio dado acumulado, com 15% de folga.
  const burnupScaleMax = useMemo(() => {
    if (annualTargetM !== null) return annualTargetM;
    const maxActual = burnupMonths.reduce((max, m) => (m.actualAcc !== null && m.actualAcc > max ? m.actualAcc : max), 0);
    return maxActual > 0 ? maxActual * 1.15 : 1;
  }, [annualTargetM, burnupMonths]);

  const burnupYFromValueM = (valueM: number) => Math.max(8, Math.min(128, 120 - (valueM / burnupScaleMax) * 100));
  const burnupPointsWithData = burnupMonths
    .map((m, idx) => ({ ...m, idx }))
    .filter(m => m.actualAcc !== null);
  const burnupPathD = burnupPointsWithData
    .map((m, i) => `${i === 0 ? 'M' : 'L'} ${50 + m.idx * 90} ${burnupYFromValueM(m.actualAcc as number)}`)
    .join(' ');

  // 12 meses de margem — dado real migrado quando existe; mês corrente usa a
  // média calculada dos projetos ativos agora; meses futuros ficam vazios.
  const marginMonths = useMemo(() => {
    return monthsBase.map((m, idx) => {
      const isCurrent = idx === currentMonthIdx;
      const isFuture = idx > currentMonthIdx;
      const entry = historyByMonth.get(idx);

      let value: number | null = null;
      if (entry) {
        value = entry.marginAvg;
      } else if (isCurrent && currentAvgMargin !== null) {
        value = currentAvgMargin;
      }

      return { month: m, value, isCurrent, isFuture, hasData: !!entry };
    });
  }, [historyByMonth, currentAvgMargin, currentMonthIdx, monthsBase]);

  const marginValues = marginMonths.map(m => m.value).filter((v): v is number => v !== null);
  const marginAverage = marginValues.length > 0
    ? marginValues.reduce((a, b) => a + b, 0) / marginValues.length
    : null;

  // Referência de cor das barras: a meta quando existe, senão a média do período.
  const marginColorBaseline = MARGIN_TARGET ?? marginAverage;

  // Topo do eixo: acomoda qualquer mês acima de 35% em vez de estourar a barra.
  const MARGIN_MAX = useMemo(() => {
    const maxValue = marginValues.length > 0 ? Math.max(...marginValues) : 0;
    const withTarget = MARGIN_TARGET !== null ? Math.max(maxValue, MARGIN_TARGET) : maxValue;
    return Math.max(35, Math.ceil((withTarget * 1.15) / 5) * 5);
  }, [marginValues, MARGIN_TARGET]);

  const MARGIN_FLOOR_Y = 114;
  const MARGIN_SPAN_Y = 82;
  const targetBaselineY = MARGIN_TARGET !== null
    ? MARGIN_FLOOR_Y - (MARGIN_TARGET / MARGIN_MAX) * MARGIN_SPAN_Y
    : null;

  // Mês atual (calendário): valor da barra do mês, vindo do histórico (parcial)
  // ou, sem histórico, da média dos projetos ativos agora.
  const valorMesAtual = marginMonths[currentMonthIdx]?.value ?? null;
  const entradaMesAtual = historyByMonth.get(currentMonthIdx);
  const mesAtualParcial = !entradaMesAtual || !!entradaMesAtual.parcial;
  const deltaMesAtual = isPortfolioWide && entradaMesAtual
    ? computeDelta(monthlyHistory, 'marginAvg', currentYear, currentMonthIdx + 1)
    : null;

  // Média móvel anual: média acumulada dos meses com dado até cada mês. Sem meta
  // configurada, é a linha tracejada de referência do gráfico.
  const mediaMovelAnual = useMemo(() => {
    let soma = 0;
    let n = 0;
    return marginMonths.map(m => {
      if (m.value === null || m.isFuture) return null;
      soma += m.value;
      n += 1;
      return soma / n;
    });
  }, [marginMonths]);

  // Variação da margem do mês de referência contra o mês anterior (histórico)
  const marginDelta = isPortfolioWide
    ? computeDelta(monthlyHistory, 'marginAvg', referenceMonth.year, referenceMonth.month)
    : null;
  const referenceMarginValue = metricForMonth(monthlyHistory, 'marginAvg', referenceMonth.year, referenceMonth.month);

  const referenceLabel = `${MONTH_FULL[referenceMonth.month - 1]}/${referenceMonth.year}`;

  // Classes compartilhadas dos cartões
  const cardValueClass = `text-lg sm:text-xl font-black tracking-tight my-0.5 ${
    isLight ? 'text-slate-900' : 'text-white'
  }`;
  const emptyValueClass = `text-lg sm:text-xl font-black tracking-tight my-0.5 ${
    isLight ? 'text-slate-300' : 'text-slate-600'
  }`;

  return (
    <div className={`w-full flex flex-col gap-2 max-w-[1600px] mx-auto ${
      isLight ? 'text-slate-900' : 'text-slate-100'
    }`}>
      {/* ========================================================================= */}
      {/* 1. PRINCIPAIS INFORMAÇÕES DO MÊS - 4 CAIXAS NA HORIZONTAL                 */}
      {/* ========================================================================= */}
      <ContainerSlot id="one_page__principais_informacoes" layout={containerLayout} isPmo={isPmo}>
      <div className={`p-2.5 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0A1C30] border-[#16385C] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide mb-2 pb-1 border-b ${
          isLight ? 'text-slate-900 border-slate-200' : 'text-white border-slate-800'
        }`}>
          <span>Principais informações do mês</span>
          <div className="flex items-center gap-2">
            {hasHistory && (
              <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 border normal-case ${
                isLight
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-[#071626] text-exed-accent border-exed-accent/30'
              }`}>
                {referenceLabel}{referenceMonth.parcial ? ' (parcial)' : ''}
              </span>
            )}
            {!isPortfolioWide && (
              <span
                className={`text-[9px] font-semibold px-1.5 py-0.5 border normal-case ${
                  isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
                title="O histórico mensal é agregado do portfólio inteiro e não separa por frente de solução. Com um filtro ativo, os comparativos seriam calculados sobre uma base diferente da mostrada, então ficam ocultos."
              >
                Comparativos ocultos sob filtro
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Card 1: FATURAMENTO DO MÊS - Verde */}
          <button
            type="button"
            onClick={() => setExpandedMetric(METRIC_REVENUE)}
            title="Clique para ver o histórico mês a mês"
            className={`text-left p-2 flex flex-col justify-between border transition-colors cursor-pointer ${
              isLight
                ? 'bg-slate-50 border-slate-200 hover:border-emerald-500'
                : 'bg-[#071626] border-[#16385C] hover:border-[#00FF88]/50'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-[10px] font-extrabold tracking-wider uppercase ${
                isLight ? 'text-emerald-700' : 'text-[#00FF88]'
              }`}>
                FATURAMENTO DO MÊS
              </span>
              {cardRevenue.delta
                ? <MoMBadge delta={cardRevenue.delta} text={formatDeltaPercent(cardRevenue.delta)} theme={theme} />
                : isPortfolioWide && <MoMEmpty theme={theme} />}
            </div>
            <div className={cardRevenue.value !== null ? cardValueClass : emptyValueClass}>
              {cardRevenue.value !== null ? formatCurrencyBRL(cardRevenue.value) : '—'}
            </div>
            {/* Sparkline: só existe com 2+ meses migrados */}
            <div className="h-5 w-full pt-0.5">
              {cardRevenue.sparkline ? (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 200 30">
                  <defs>
                    <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00FF88" stopOpacity={isLight ? '0.15' : '0.3'} />
                      <stop offset="100%" stopColor="#00FF88" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polygon points={cardRevenue.sparkline.areaPoints} fill="url(#gradGreen)" />
                  <polyline
                    fill="none"
                    stroke={isLight ? '#059669' : '#00FF88'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={cardRevenue.sparkline.linePoints}
                  />
                  <circle
                    cx={cardRevenue.sparkline.last.x}
                    cy={cardRevenue.sparkline.last.y}
                    r="2.5"
                    fill={isLight ? '#059669' : '#00FF88'}
                  />
                </svg>
              ) : null}
            </div>
          </button>

          {/* Card 2: GASTO TOTAL DO MÊS - queda é favorável */}
          <button
            type="button"
            onClick={() => setExpandedMetric(METRIC_SPEND)}
            title="Clique para ver o histórico mês a mês"
            className={`text-left p-2 flex flex-col justify-between border transition-colors cursor-pointer ${
              isLight
                ? 'bg-slate-50 border-slate-200 hover:border-emerald-500'
                : 'bg-[#071626] border-[#16385C] hover:border-[#00FF88]/50'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-[10px] font-extrabold tracking-wider uppercase ${
                isLight ? 'text-slate-700' : 'text-slate-300'
              }`}>
                GASTO TOTAL DO MÊS
              </span>
              {cardSpend.delta
                ? <MoMBadge delta={cardSpend.delta} text={formatDeltaPercent(cardSpend.delta)} higherIsBetter={false} theme={theme} />
                : isPortfolioWide && <MoMEmpty theme={theme} />}
            </div>
            <div className={cardSpend.value !== null ? cardValueClass : emptyValueClass}>
              {cardSpend.value !== null ? formatCurrencyBRL(cardSpend.value) : '—'}
            </div>
            <div className="h-5 w-full pt-0.5">
              {cardSpend.sparkline ? (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 200 30">
                  <defs>
                    <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D2FF" stopOpacity={isLight ? '0.15' : '0.25'} />
                      <stop offset="100%" stopColor="#00D2FF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polygon points={cardSpend.sparkline.areaPoints} fill="url(#gradSpend)" />
                  <polyline
                    fill="none"
                    stroke={isLight ? '#0284C7' : '#00D2FF'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={cardSpend.sparkline.linePoints}
                  />
                  <circle
                    cx={cardSpend.sparkline.last.x}
                    cy={cardSpend.sparkline.last.y}
                    r="2.5"
                    fill={isLight ? '#0284C7' : '#00D2FF'}
                  />
                </svg>
              ) : null}
            </div>
          </button>

          {/* Card 3: Total de clientes atendidos - Azul */}
          <button
            type="button"
            onClick={() => setExpandedMetric(METRIC_CLIENTS)}
            title="Clique para ver o histórico mês a mês"
            className={`text-left p-2 flex flex-col justify-between border transition-colors cursor-pointer ${
              isLight
                ? 'bg-slate-50 border-slate-200 hover:border-blue-500'
                : 'bg-[#071626] border-[#16385C] hover:border-[#00D2FF]/50'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-[10px] font-extrabold tracking-wider uppercase ${
                isLight ? 'text-blue-700' : 'text-[#00D2FF]'
              }`}>
                Total de clientes atendidos
              </span>
              {cardClients.delta
                ? <MoMBadge delta={cardClients.delta} text={formatDeltaAbs(cardClients.delta)} theme={theme} />
                : isPortfolioWide && <MoMEmpty theme={theme} />}
            </div>
            <div className={cardClients.value !== null ? cardValueClass : cardValueClass}>
              {cardClients.value !== null ? cardClients.value : uniqueClients}{' '}
              <span className="text-xs font-normal text-slate-400">
                clientes
                {cardClients.value === null && (
                  <span
                    className="ml-1 text-[9px] italic"
                    title="Contagem ao vivo dos projetos ativos. O mês de referência ainda não tem clientsServed migrado, então não há comparativo."
                  >
                    (atual)
                  </span>
                )}
              </span>
            </div>
            <div className="h-5 w-full pt-0.5">
              {cardClients.sparkline ? (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 200 30">
                  <defs>
                    <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D2FF" stopOpacity={isLight ? '0.15' : '0.3'} />
                      <stop offset="100%" stopColor="#00D2FF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polygon points={cardClients.sparkline.areaPoints} fill="url(#gradBlue)" />
                  <polyline
                    fill="none"
                    stroke={isLight ? '#0284C7' : '#00D2FF'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={cardClients.sparkline.linePoints}
                  />
                  <circle
                    cx={cardClients.sparkline.last.x}
                    cy={cardClients.sparkline.last.y}
                    r="2.5"
                    fill={isLight ? '#0284C7' : '#00D2FF'}
                  />
                </svg>
              ) : null}
            </div>
          </button>

          {/* Card 4: Total de Go-Lives no mês */}
          <button
            type="button"
            onClick={() => setExpandedMetric(METRIC_GOLIVES)}
            title="Clique para ver o histórico mês a mês"
            className={`text-left p-2 flex flex-col justify-between border transition-colors cursor-pointer ${
              isLight
                ? 'bg-slate-50 border-slate-200 hover:border-exed-accent'
                : 'bg-[#071626] border-[#16385C] hover:border-exed-accent/50'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-extrabold tracking-wider uppercase text-exed-accent">
                Total de Go-Lives no mês
              </span>
              {cardGoLives.delta
                ? <MoMBadge delta={cardGoLives.delta} text={formatDeltaAbs(cardGoLives.delta)} theme={theme} />
                : isPortfolioWide && <MoMEmpty theme={theme} />}
            </div>
            <div className={cardGoLives.value !== null ? cardValueClass : emptyValueClass}>
              {cardGoLives.value !== null ? cardGoLives.value : '—'}{' '}
              {cardGoLives.value !== null && (
                <span className="text-xs font-normal text-slate-400">projetos ativados</span>
              )}
            </div>
            <div className="h-5 w-full pt-0.5">
              {cardGoLives.sparkline ? (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 200 30">
                  <defs>
                    <linearGradient id="gradAccent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--exed-accent)" stopOpacity={isLight ? '0.15' : '0.3'} />
                      <stop offset="100%" stopColor="var(--exed-accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polygon points={cardGoLives.sparkline.areaPoints} fill="url(#gradAccent)" />
                  <polyline
                    fill="none"
                    stroke="var(--exed-accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={cardGoLives.sparkline.linePoints}
                  />
                  <circle
                    cx={cardGoLives.sparkline.last.x}
                    cy={cardGoLives.sparkline.last.y}
                    r="2.5"
                    fill="var(--exed-accent)"
                  />
                </svg>
              ) : null}
            </div>
          </button>
        </div>

        {!hasHistory && (
          <div className={`mt-2 text-[10px] italic px-2 py-1.5 border ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#071626] border-slate-800 text-slate-400'
          }`}>
            Nenhum mês migrado no histórico ainda — os cartões ficam em "—" até a carga dos dados.
            Preencha em Configurações → Histórico Mensal ou rode a migração das RSE.
          </div>
        )}
      </div>
      </ContainerSlot>

      {/* ========================================================================= */}
      {/* 2. RECEITA ACUMULADA - BURNUP CHART (ESTÁTICO, SEM ANIMAÇÃO)              */}
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
            Faturamento acumulado
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            {/* T7: a linha base só aparece quando existe meta configurada, e o
                valor da meta não é mais escrito na interface. */}
            {hasRevenueTarget && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-b border-dashed border-slate-400"></span>
                <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>Linha base</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className={`w-3 h-1 ${isLight ? 'bg-emerald-600' : 'bg-[#00FF88]'}`}></span>
              <span className={`font-semibold ${isLight ? 'text-emerald-700' : 'text-[#00FF88]'}`}>
                Faturamento Real Acumulado
                {firstBurnupIdx !== null && firstBurnupIdx > 0 ? ` desde ${monthsBase[firstBurnupIdx]}` : ''}
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
                  stroke={m.current ? 'var(--exed-accent)' : isLight ? '#E2E8F0' : '#10253D'}
                  strokeWidth={m.current ? '1.5' : '1'}
                  strokeDasharray={m.current ? '2 2' : 'none'}
                />
              );
            })}

            {/* Linha base da meta: só desenhada quando há meta configurada */}
            {hasRevenueTarget && (
              <line
                x1="50"
                y1={burnupYFromValueM((annualTargetM as number) / 12)}
                x2="1040"
                y2={burnupYFromValueM(annualTargetM as number)}
                stroke={isLight ? '#94A3B8' : '#64748B'}
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
            )}

            {/* Faturamento real acumulado (calculado a partir do histórico migrado) */}
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

            {/* Pontos nos meses com dado real */}
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
                      fill={isCurrent ? 'var(--exed-accent)' : isLight ? '#059669' : '#00FF88'}
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
                  fill={
                    isCurrent
                      ? 'var(--exed-accent)'
                      : m.actualAcc !== null
                      ? isLight ? '#334155' : '#CBD5E1'
                      : isLight ? '#94A3B8' : '#475569'
                  }
                  fontSize="10"
                  fontWeight="bold"
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
            </div>
          )}
        </div>
      </div>
      </ContainerSlot>

      {/* ========================================================================= */}
      {/* 3. EVOLUÇÃO DA MARGEM - 25% MÊS DE REFERÊNCIA + 75% GRÁFICO DE COLUNAS    */}
      {/* ========================================================================= */}
      <ContainerSlot id="one_page__meta_margem" layout={containerLayout} isPmo={isPmo}>
      <div className={`p-2.5 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#0A1C30] border-[#16385C] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide mb-2 pb-1 border-b ${
          isLight ? 'text-slate-900 border-slate-200' : 'text-white border-slate-800'
        }`}>
          <span>Evolução da margem</span>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold normal-case tracking-normal">
            <span className={`w-4 border-b border-dashed ${isLight ? 'border-sky-600' : 'border-[#00D2FF]'}`}></span>
            <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>
              {MARGIN_TARGET !== null ? 'Meta de margem' : 'Média móvel anual'}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5 items-stretch">
          {/* Esquerda 25%: em cima a meta (sem meta, a média do ano); embaixo o mês atual */}
          <div className={`lg:col-span-1 p-2.5 flex flex-col justify-between border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#071626] border-[#1E436E]'
          }`}>
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}>
                {MARGIN_TARGET !== null ? 'Meta de margem' : `Média do ano (${currentYear})`}
              </div>
              <span className={`text-2xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {MARGIN_TARGET !== null
                  ? `${MARGIN_TARGET.toFixed(1)}%`
                  : marginAverage !== null
                  ? `${marginAverage.toFixed(1)}%`
                  : '—'}
              </span>
              <div className="text-[9px] mt-0.5 text-slate-500">
                {MARGIN_TARGET !== null
                  ? 'Linha tracejada do gráfico.'
                  : 'Média dos meses com dado no ano. É a linha tracejada do gráfico.'}
              </div>
            </div>

            <div className={`pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Média do mês atual ({monthsBase[currentMonthIdx]}{mesAtualParcial ? ', parcial' : ''})
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-xl font-black ${isLight ? 'text-emerald-700' : 'text-[#00FF88]'}`}>
                  {valorMesAtual !== null ? `${valorMesAtual.toFixed(1)}%` : '—'}
                </span>
                {deltaMesAtual && (
                  <MoMBadge delta={deltaMesAtual} text={formatDeltaPp(deltaMesAtual)} theme={theme} suffix="" />
                )}
              </div>
            </div>
          </div>

          {/* Direita 75% — gráfico de colunas */}
          <div className={`lg:col-span-3 p-2 flex flex-col justify-between border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#071626] border-[#1E436E]'
          }`}>
            <div className="relative w-full h-32 sm:h-36 select-none">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 145" preserveAspectRatio="none">
                {/* Linha base da meta: só quando existe meta configurada */}
                {targetBaselineY !== null && (
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
                )}

                {marginMonths.map((m, idx) => {
                  const colWidth = 28;
                  const colSpacing = 77;
                  const x = 50 + idx * colSpacing;
                  const isCurrent = !!m.isCurrent;
                  const isFuture = !!m.isFuture;

                  if (m.value === null) {
                    // Mês sem dado migrado: sem barra, só um indicador discreto
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
                        {!isFuture && (
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
                        )}
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
                  // Com meta: acima/abaixo da meta. Sem meta: acima/abaixo da
                  // média do próprio período. Nunca uma referência inventada.
                  const aboveBaseline = marginColorBaseline === null ? true : m.value >= marginColorBaseline;
                  const isBelowBaseline = !aboveBaseline;

                  const barFill = isLight
                    ? aboveBaseline ? '#059669' : '#DC2626'
                    : aboveBaseline ? '#00FF88' : '#FF3366';

                  const textY = isBelowBaseline ? barY + 11 : barY - 5;
                  const textColor = isBelowBaseline
                    ? '#FFFFFF'
                    : isCurrent
                    ? isLight ? '#059669' : '#00FF88'
                    : isLight ? '#475569' : '#94A3B8';

                  return (
                    <g key={m.month}>
                      <rect
                        x={x}
                        y={barY}
                        width={colWidth}
                        height={barHeight}
                        fill={barFill}
                        opacity={m.hasData ? 1.0 : 0.55}
                      />

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

                      <text
                        x={x + colWidth / 2}
                        y={textY}
                        textAnchor="middle"
                        fill={textColor}
                        fontSize={isBelowBaseline ? '8.5' : '9'}
                        fontFamily="monospace"
                        fontWeight={isBelowBaseline || isCurrent ? 'bold' : 'normal'}
                      >
                        {m.value.toFixed(1)}%
                      </text>

                      <text
                        x={x + colWidth / 2}
                        y="128"
                        textAnchor="middle"
                        fill={
                          isCurrent
                            ? 'var(--exed-accent)'
                            : isFuture
                            ? isLight ? '#94A3B8' : '#475569'
                            : isLight ? '#334155' : '#CBD5E1'
                        }
                        fontSize="10"
                        fontWeight={isCurrent ? 'bold' : 'normal'}
                      >
                        {m.month}
                      </text>

                      {isCurrent && (
                        <text
                          x={x + colWidth / 2}
                          y="139"
                          textAnchor="middle"
                          fill="var(--exed-accent)"
                          fontSize="7"
                          fontWeight="bold"
                        >
                          MÊS
                        </text>
                      )}
                    </g>
                  );
                })}
                {/* Sem meta: a linha tracejada é a média móvel anual */}
                {targetBaselineY === null && (() => {
                  const colWidth = 28;
                  const colSpacing = 77;
                  const pontos = mediaMovelAnual
                    .map((v, idx) =>
                      v === null
                        ? null
                        : { x: 50 + idx * colSpacing + colWidth / 2, y: MARGIN_FLOOR_Y - (v / MARGIN_MAX) * MARGIN_SPAN_Y }
                    )
                    .filter((pt): pt is { x: number; y: number } => pt !== null);
                  if (pontos.length === 0) return null;
                  const traco =
                    pontos.length === 1
                      ? `${pontos[0].x - 30},${pontos[0].y} ${pontos[0].x + 30},${pontos[0].y}`
                      : pontos.map(pt => `${pt.x},${pt.y}`).join(' ');
                  return (
                    <polyline
                      points={traco}
                      fill="none"
                      stroke={isLight ? '#0284C7' : '#00D2FF'}
                      strokeWidth="1.5"
                      strokeDasharray="5 4"
                      opacity="0.85"
                    />
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>
      </div>
      </ContainerSlot>

      {/* ========================================================================= */}
      {/* 4. CONTRIBUIÇÕES - TABELAS DIVIDIDAS NO PONTO VERTICAL                     */}
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
          Contribuições por cliente
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x gap-y-2 lg:gap-y-0 ${
          isLight ? 'divide-slate-200' : 'divide-slate-800'
        }`}>
          {/* Tabela 1: Clientes com maior contribuição na receita */}
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
                          {rot.solucao(c.solution)}
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

          {/* Tabela 2: Clientes com maior contribuição na margem */}
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
                          {rot.solucao(c.solution)}
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

      {/* T5 — modal de expansão do cartão clicado */}
      {expandedMetric && (
        <MonthlyKpiDetailModal
          metric={expandedMetric}
          monthlyHistory={monthlyHistory}
          refYear={referenceMonth.year}
          refMonth={referenceMonth.month}
          theme={theme}
          onClose={() => setExpandedMetric(null)}
        />
      )}
    </div>
  );
};
