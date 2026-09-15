import { MonthlyKpiSnapshot, MonthlyProjectSnapshot } from '../types';

// ==============================================================================
// COMPARATIVOS MÊS A MÊS — FONTE ÚNICA DE CÁLCULO
// ==============================================================================
// Todas as páginas do dashboard (One Page, Pontos de Atenção, Informações Gerais
// e Detalhamento Financeiro) usam este módulo para calcular variação contra o
// mês anterior. A regra vale para todas elas, sem exceção:
//
//   SEM DADO → SEM COMPARATIVO.
//
// Nunca estimar, nunca interpolar, nunca desenhar uma curva "de enfeite".
// Quando falta o mês anterior, a interface mostra "—" e pronto. Um número
// inventado num relatório executivo é pior do que um espaço em branco.
// ==============================================================================

/** Campos numéricos agregados de MonthlyKpiSnapshot que podem ser comparados. */
export type MonthlyMetricKey =
  | 'revenueBilled'
  | 'marginAvg'
  | 'totalSpend'
  | 'clientsServed'
  | 'goLivesCompleted'
  | 'activeProjects'
  | 'avgScheduleDelay'
  | 'npsAvg'
  | 'signedDocsAvg'
  | 'detractorCount'
  | 'almAdoptionPercent'
  | 'openCrCount'
  | 'openCrValue'
  | 'plannedBudgetTotal'
  | 'reimbursableTotal';

export interface MonthlyPoint {
  monthKey: string;
  year: number;
  month: number; // 1 a 12
  label: string; // 'Jan', 'Fev', ...
  value: number | null; // null = mês sem dado migrado
}

export interface MonthlyDelta {
  current: number;
  previous: number;
  /** Diferença absoluta (current - previous). */
  abs: number;
  /**
   * Variação percentual. `null` quando o mês anterior é 0 — dividir por zero
   * produziria Infinity e um badge de "+∞%" no relatório executivo.
   */
  percent: number | null;
  currentMonthKey: string;
  previousMonthKey: string;
}

export const MONTH_ABBR = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export const MONTH_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Recua `steps` meses a partir de (year, month), virando o ano quando preciso. */
export function shiftMonth(year: number, month: number, steps: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + steps;
  return {
    year: Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1
  };
}

function indexHistory(history: MonthlyKpiSnapshot[]): Map<string, MonthlyKpiSnapshot> {
  const map = new Map<string, MonthlyKpiSnapshot>();
  (history || []).forEach(entry => {
    if (entry && entry.monthKey) map.set(entry.monthKey, entry);
  });
  return map;
}

function readMetric(entry: MonthlyKpiSnapshot | undefined, metric: MonthlyMetricKey): number | null {
  if (!entry) return null;
  const raw = entry[metric];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/**
 * Série dos últimos `months` meses terminando em (refYear, refMonth), inclusive.
 * Meses sem dado entram com `value: null` — quem consome decide se desenha.
 */
export function buildMonthlySeries(
  history: MonthlyKpiSnapshot[],
  metric: MonthlyMetricKey,
  refYear: number,
  refMonth: number,
  months = 7
): MonthlyPoint[] {
  const byKey = indexHistory(history);
  const points: MonthlyPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const { year, month } = shiftMonth(refYear, refMonth, -i);
    const monthKey = toMonthKey(year, month);
    points.push({
      monthKey,
      year,
      month,
      label: MONTH_ABBR[month - 1],
      value: readMetric(byKey.get(monthKey), metric)
    });
  }

  return points;
}

/**
 * Variação do mês de referência contra o mês imediatamente anterior.
 * Devolve `null` se qualquer um dos dois meses não tiver o dado — é isso que
 * impede um badge de aparecer sobre base inventada.
 */
export function computeDelta(
  history: MonthlyKpiSnapshot[],
  metric: MonthlyMetricKey,
  refYear: number,
  refMonth: number
): MonthlyDelta | null {
  const byKey = indexHistory(history);
  const currentKey = toMonthKey(refYear, refMonth);
  const prev = shiftMonth(refYear, refMonth, -1);
  const previousKey = toMonthKey(prev.year, prev.month);

  const current = readMetric(byKey.get(currentKey), metric);
  const previous = readMetric(byKey.get(previousKey), metric);

  if (current === null || previous === null) return null;

  return {
    current,
    previous,
    abs: current - previous,
    percent: previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100,
    currentMonthKey: currentKey,
    previousMonthKey: previousKey
  };
}

/** Valor do mês de referência, ou null se o mês não foi migrado. */
export function metricForMonth(
  history: MonthlyKpiSnapshot[],
  metric: MonthlyMetricKey,
  refYear: number,
  refMonth: number
): number | null {
  return readMetric(indexHistory(history).get(toMonthKey(refYear, refMonth)), metric);
}

/**
 * Converte uma série em coordenadas de polyline SVG.
 * Retorna `null` quando há menos de 2 pontos com dado — uma "linha" de um ponto
 * só não é uma tendência, e desenhá-la seria enfeite.
 *
 * Os `null` do meio da série são ignorados (a linha liga os pontos que existem),
 * mas o eixo X mantém a posição cronológica real de cada mês, então um buraco
 * aparece como um segmento mais longo, e não como um mês comprimido.
 */
export function buildSparkline(
  points: MonthlyPoint[],
  width = 200,
  height = 30,
  padding = 4
): { linePoints: string; areaPoints: string; last: { x: number; y: number } } | null {
  const withData = points
    .map((p, idx) => ({ ...p, idx }))
    .filter(p => p.value !== null) as Array<MonthlyPoint & { idx: number; value: number }>;

  if (withData.length < 2) return null;

  const values = withData.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const usableHeight = height - padding * 2;
  const lastIdx = points.length - 1;

  const coords = withData.map(p => {
    const x = lastIdx === 0 ? width : (p.idx / lastIdx) * width;
    // Série constante (span 0): desenha no meio, não colada no topo.
    const ratio = span === 0 ? 0.5 : (p.value - min) / span;
    const y = padding + (1 - ratio) * usableHeight;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });

  const linePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaPoints = `${linePoints} ${last.x},${height} ${first.x},${height}`;

  return { linePoints, areaPoints, last };
}

// ------------------------------------------------------------------ Formatação

export function formatDeltaPercent(delta: MonthlyDelta, digits = 1): string {
  if (delta.percent === null) return '—';
  const sign = delta.percent > 0 ? '+' : '';
  return `${sign}${delta.percent.toFixed(digits)}%`;
}

export function formatDeltaAbs(delta: MonthlyDelta, digits = 0, suffix = ''): string {
  const sign = delta.abs > 0 ? '+' : '';
  return `${sign}${delta.abs.toFixed(digits)}${suffix}`;
}

/** Variação em pontos percentuais — para métricas que já são % (margem, NPS, ALM). */
export function formatDeltaPp(delta: MonthlyDelta, digits = 1): string {
  const sign = delta.abs > 0 ? '+' : '';
  return `${sign}${delta.abs.toFixed(digits)} p.p.`;
}

/**
 * Se a variação é uma boa notícia. `higherIsBetter = false` inverte a leitura
 * (gasto, atraso e CR em aberto subindo é ruim, não bom).
 * Variação exatamente zero conta como neutra-favorável.
 */
export function isFavorable(delta: MonthlyDelta, higherIsBetter = true): boolean {
  if (delta.abs === 0) return true;
  return higherIsBetter ? delta.abs > 0 : delta.abs < 0;
}

// ------------------------------------------------- Comparativo por projeto

function indexProjectSnapshots(entry: MonthlyKpiSnapshot | undefined): Map<string, MonthlyProjectSnapshot> {
  const map = new Map<string, MonthlyProjectSnapshot>();
  (entry?.projectSnapshots || []).forEach(snap => {
    if (snap && snap.projectId) map.set(snap.projectId, snap);
  });
  return map;
}

export type ProjectMetricKey = 'budgetRealized' | 'billed' | 'marginPercent' | 'reimbursableExpenseTotal';

export interface ProjectVarianceResult {
  /** Variação percentual contra o mês anterior. */
  percent: number;
  /** 'calculado' = veio do histórico; 'manual' = campo digitado pelo PMO. */
  source: 'calculado' | 'manual';
}

/**
 * Variação de um projeto contra o mês anterior.
 *
 * Ordem de preferência, deliberada:
 *   1. CALCULADO a partir de projectSnapshots (dois meses presentes no histórico)
 *   2. MANUAL — o campo resourceVariancePercent digitado pelo PMO
 *   3. null — nada a mostrar; a tabela exibe "—"
 *
 * O passo 2 existe só enquanto o histórico por projeto não estiver migrado.
 * Assim que houver dois meses com projectSnapshots, o cálculo assume sozinho e
 * o número digitado para de importar — inclusive se estiver desatualizado.
 */
export function computeProjectVariance(
  history: MonthlyKpiSnapshot[],
  projectId: string,
  metric: ProjectMetricKey,
  refYear: number,
  refMonth: number,
  manualFallback?: number
): ProjectVarianceResult | null {
  const byKey = indexHistory(history);
  const prev = shiftMonth(refYear, refMonth, -1);

  const currentSnaps = indexProjectSnapshots(byKey.get(toMonthKey(refYear, refMonth)));
  const previousSnaps = indexProjectSnapshots(byKey.get(toMonthKey(prev.year, prev.month)));

  const currentRaw = currentSnaps.get(projectId)?.[metric];
  const previousRaw = previousSnaps.get(projectId)?.[metric];

  const hasBoth =
    typeof currentRaw === 'number' && Number.isFinite(currentRaw) &&
    typeof previousRaw === 'number' && Number.isFinite(previousRaw) &&
    previousRaw !== 0;

  if (hasBoth) {
    return {
      percent: ((currentRaw - previousRaw) / Math.abs(previousRaw)) * 100,
      source: 'calculado'
    };
  }

  if (typeof manualFallback === 'number' && Number.isFinite(manualFallback) && manualFallback !== 0) {
    return { percent: manualFallback, source: 'manual' };
  }

  return null;
}

/** true quando ao menos um mês do histórico já traz detalhe por projeto. */
export function hasProjectSnapshots(history: MonthlyKpiSnapshot[]): boolean {
  return (history || []).some(h => Array.isArray(h.projectSnapshots) && h.projectSnapshots.length > 0);
}

/**
 * Mês mais recente presente no histórico — é ele que serve de referência para
 * todos os comparativos do dashboard.
 *
 * Deliberadamente NÃO é o mês corrente do calendário: a RSE de um mês só é
 * publicada no início do mês seguinte, então o mês corrente quase sempre ainda
 * não fechou. Usar o calendário faria todo comparativo sumir durante as
 * primeiras semanas de cada mês.
 *
 * Devolve `null` com histórico vazio — sem histórico não há o que comparar.
 */
export function latestHistoryMonth(
  history: MonthlyKpiSnapshot[]
): { year: number; month: number; monthKey: string } | null {
  const sorted = (history || [])
    .filter(h => h && h.monthKey)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  return { year: latest.year, month: latest.month, monthKey: latest.monthKey };
}
