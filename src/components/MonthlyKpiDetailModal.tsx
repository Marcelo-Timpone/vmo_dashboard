import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { AppTheme, MonthlyKpiSnapshot } from '../types';
import {
  MonthlyMetricKey,
  buildMonthlySeries,
  computeDelta,
  MONTH_FULL,
  shiftMonth,
  toMonthKey
} from '../utils/monthlyComparison';

// ==============================================================================
// T5 — EXPANSÃO DO CARTÃO: GRÁFICO GRANDE + TABELA HISTÓRICA
// ==============================================================================
// Abre sobre a One Page ao clicar num dos cartões de "Principais informações do
// mês". Consome exatamente os mesmos campos de MonthlyKpiSnapshot usados pelos
// sparklines — nenhum número novo é criado aqui.
// ==============================================================================

export interface KpiMetricDefinition {
  key: MonthlyMetricKey;
  label: string;
  /** Formata o valor para exibição (eixo, tabela e tooltip). */
  format: (value: number) => string;
  /** Cor da série. Aceita hex ou var(--token). */
  color: string;
  /** false quando subir é ruim (gasto). Define a cor da variação na tabela. */
  higherIsBetter?: boolean;
  /** Barras para contagens, linha para valores contínuos. */
  chartStyle?: 'line' | 'bar';
}

interface MonthlyKpiDetailModalProps {
  metric: KpiMetricDefinition;
  monthlyHistory: MonthlyKpiSnapshot[];
  refYear: number;
  refMonth: number; // 1 a 12
  theme?: AppTheme;
  onClose: () => void;
  /** Quantos meses mostrar no gráfico grande. */
  months?: number;
}

export const MonthlyKpiDetailModal: React.FC<MonthlyKpiDetailModalProps> = ({
  metric,
  monthlyHistory,
  refYear,
  refMonth,
  theme = 'neon',
  onClose,
  months = 12
}) => {
  const isLight = theme === 'light';

  // Fechar com ESC — um dashboard de tela cheia sem saída pelo teclado irrita.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const series = useMemo(
    () => buildMonthlySeries(monthlyHistory, metric.key, refYear, refMonth, months),
    [monthlyHistory, metric.key, refYear, refMonth, months]
  );

  const pointsWithData = series.filter(p => p.value !== null) as Array<{ value: number } & typeof series[number]>;

  // Escala do eixo Y calculada do próprio dado, com uma folga de 10%.
  const { minY, maxY } = useMemo(() => {
    if (pointsWithData.length === 0) return { minY: 0, maxY: 1 };
    const values = pointsWithData.map(p => p.value as number);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    if (rawMin === rawMax) {
      const pad = Math.abs(rawMin) * 0.1 || 1;
      return { minY: rawMin - pad, maxY: rawMax + pad };
    }
    const pad = (rawMax - rawMin) * 0.1;
    // Métricas não-negativas começam do zero quando isso não achata o gráfico.
    const floor = rawMin >= 0 && rawMin - pad < 0 ? 0 : rawMin - pad;
    return { minY: floor, maxY: rawMax + pad };
  }, [pointsWithData]);

  // Espaço do SVG: 900 x 320, com margens para rótulos.
  const W = 900;
  const H = 320;
  const ML = 90;
  const MR = 24;
  const MT = 20;
  const MB = 46;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const xFor = (idx: number) =>
    series.length <= 1 ? ML + plotW / 2 : ML + (idx / (series.length - 1)) * plotW;
  const yFor = (value: number) =>
    maxY === minY ? MT + plotH / 2 : MT + (1 - (value - minY) / (maxY - minY)) * plotH;

  const linePath = pointsWithData
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(series.indexOf(p)).toFixed(1)} ${yFor(p.value as number).toFixed(1)}`)
    .join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  // Tabela em ordem decrescente: o mês mais recente primeiro.
  const tableRows = useMemo(() => {
    return [...series].reverse().map(point => {
      const delta = computeDelta(monthlyHistory, metric.key, point.year, point.month);
      return { point, delta };
    });
  }, [series, monthlyHistory, metric.key]);

  const higherIsBetter = metric.higherIsBetter !== false;
  const useBars = metric.chartStyle === 'bar';
  const barWidth = Math.max(10, Math.min(40, (plotW / Math.max(series.length, 1)) * 0.5));

  const panelBg = isLight ? 'bg-white border-slate-300' : 'bg-[#0A1C30] border-[#16385C]';
  const innerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#071626] border-[#1E436E]';
  const muted = isLight ? 'text-slate-500' : 'text-slate-400';
  const gridStroke = isLight ? '#E2E8F0' : '#132B47';

  const monthsMigrated = pointsWithData.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/70 no-print"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Histórico de ${metric.label}`}
    >
      <div
        className={`w-full max-w-[1100px] max-h-[92vh] overflow-y-auto border shadow-2xl ${panelBg}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 border-b sticky top-0 z-10 ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#0A1C30] border-slate-800'
          }`}
        >
          <div className="flex flex-col">
            <span className={`text-sm font-black uppercase tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {metric.label}
            </span>
            <span className={`text-[10px] ${muted}`}>
              Histórico mês a mês · {monthsMigrated} de {series.length}{' '}
              {series.length === 1 ? 'mês migrado' : 'meses migrados'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer border transition-colors ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-[#071626] hover:bg-[#0E2847] text-[#00D2FF] hover:text-white border-[#1E436E]'
            }`}
          >
            <X size={12} />
            <span>Fechar</span>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {monthsMigrated === 0 ? (
            <div
              className={`text-xs py-10 text-center italic border ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#071626] border-slate-800 text-slate-400'
              }`}
            >
              Nenhum mês deste indicador foi migrado ainda. Preencha em Configurações → Histórico Mensal,
              ou rode a migração das RSE.
            </div>
          ) : (
            <>
              {/* Gráfico grande */}
              <div className={`border p-3 ${innerBg}`}>
                <div className="w-full overflow-x-auto">
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[260px] sm:h-[320px] min-w-[640px]">
                    {/* Grade + rótulos do eixo Y */}
                    {gridLines.map(ratio => {
                      const y = MT + ratio * plotH;
                      const value = maxY - ratio * (maxY - minY);
                      return (
                        <g key={ratio}>
                          <line
                            x1={ML}
                            y1={y}
                            x2={W - MR}
                            y2={y}
                            stroke={gridStroke}
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={ML - 8}
                            y={y + 3.5}
                            textAnchor="end"
                            fill={isLight ? '#64748B' : '#94A3B8'}
                            fontSize="10"
                            fontFamily="monospace"
                          >
                            {metric.format(value)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Série */}
                    {useBars
                      ? pointsWithData.map(p => {
                          const idx = series.indexOf(p);
                          const x = xFor(idx) - barWidth / 2;
                          const y = yFor(p.value as number);
                          const baseY = yFor(Math.max(minY, 0));
                          return (
                            <rect
                              key={p.monthKey}
                              x={x}
                              y={Math.min(y, baseY)}
                              width={barWidth}
                              height={Math.max(2, Math.abs(baseY - y))}
                              fill={metric.color}
                              opacity={0.85}
                            />
                          );
                        })
                      : linePath && (
                          <path
                            d={linePath}
                            fill="none"
                            stroke={metric.color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                    {/* Pontos + valores */}
                    {!useBars &&
                      pointsWithData.map(p => {
                        const idx = series.indexOf(p);
                        return (
                          <g key={p.monthKey}>
                            <circle
                              cx={xFor(idx)}
                              cy={yFor(p.value as number)}
                              r="4"
                              fill={metric.color}
                              stroke={isLight ? '#FFFFFF' : '#06121E'}
                              strokeWidth="1.5"
                            />
                            <text
                              x={xFor(idx)}
                              y={yFor(p.value as number) - 10}
                              textAnchor="middle"
                              fill={isLight ? '#334155' : '#CBD5E1'}
                              fontSize="9.5"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {metric.format(p.value as number)}
                            </text>
                          </g>
                        );
                      })}

                    {useBars &&
                      pointsWithData.map(p => {
                        const idx = series.indexOf(p);
                        return (
                          <text
                            key={`lbl-${p.monthKey}`}
                            x={xFor(idx)}
                            y={yFor(p.value as number) - 6}
                            textAnchor="middle"
                            fill={isLight ? '#334155' : '#CBD5E1'}
                            fontSize="9.5"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {metric.format(p.value as number)}
                          </text>
                        );
                      })}

                    {/* Eixo X: todos os meses, inclusive os sem dado */}
                    {series.map((p, idx) => {
                      const hasData = p.value !== null;
                      return (
                        <g key={`x-${p.monthKey}`}>
                          {!hasData && (
                            <line
                              x1={xFor(idx) - 8}
                              y1={MT + plotH}
                              x2={xFor(idx) + 8}
                              y2={MT + plotH}
                              stroke={isLight ? '#CBD5E1' : '#334155'}
                              strokeWidth="2"
                              strokeDasharray="3 2"
                            />
                          )}
                          <text
                            x={xFor(idx)}
                            y={H - 26}
                            textAnchor="middle"
                            fill={hasData ? (isLight ? '#334155' : '#CBD5E1') : isLight ? '#94A3B8' : '#475569'}
                            fontSize="10.5"
                            fontWeight={hasData ? 'bold' : 'normal'}
                          >
                            {p.label}
                          </text>
                          <text
                            x={xFor(idx)}
                            y={H - 13}
                            textAnchor="middle"
                            fill={isLight ? '#94A3B8' : '#475569'}
                            fontSize="8.5"
                            fontFamily="monospace"
                          >
                            {p.year}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Tabela histórica */}
              <div className={`border ${innerBg}`}>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0">
                      <tr
                        className={`border-b text-[10px] font-bold uppercase ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-600'
                            : 'bg-[#0A1C30] border-slate-800 text-slate-400'
                        }`}
                      >
                        <th className="py-2 px-3">Mês</th>
                        <th className="py-2 px-3 text-right">{metric.label}</th>
                        <th className="py-2 px-3 text-right">Variação vs mês ant.</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-slate-800/60'}`}>
                      {tableRows.map(({ point, delta }) => {
                        const hasValue = point.value !== null;
                        const favorable = delta ? (higherIsBetter ? delta.abs >= 0 : delta.abs <= 0) : true;

                        return (
                          <tr
                            key={point.monthKey}
                            className={isLight ? 'hover:bg-slate-100/70' : 'hover:bg-[#0E2847]'}
                          >
                            <td className={`py-1.5 px-3 font-semibold text-[11px] ${hasValue ? '' : muted}`}>
                              {MONTH_FULL[point.month - 1]}/{point.year}
                            </td>
                            <td
                              className={`py-1.5 px-3 text-right font-mono font-bold text-[11px] ${
                                hasValue ? (isLight ? 'text-slate-900' : 'text-white') : muted
                              }`}
                            >
                              {hasValue ? metric.format(point.value as number) : 'sem dado migrado'}
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              {delta ? (
                                <span
                                  className={`text-[10px] font-bold font-mono px-1.5 py-0.5 border ${
                                    favorable
                                      ? isLight
                                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                        : 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
                                      : isLight
                                      ? 'text-red-700 bg-red-50 border-red-200'
                                      : 'text-[#FF3366] bg-[#FF3366]/10 border-[#FF3366]/30'
                                  }`}
                                  title={`De ${metric.format(delta.previous)} para ${metric.format(delta.current)}`}
                                >
                                  {delta.abs > 0 ? '+' : ''}
                                  {metric.format(delta.abs)}
                                  {delta.percent !== null
                                    ? ` (${delta.percent > 0 ? '+' : ''}${delta.percent.toFixed(1)}%)`
                                    : ''}
                                </span>
                              ) : (
                                <span className={`text-[10px] ${muted}`} title="Mês anterior sem dado migrado.">
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

              <div className={`text-[10px] ${muted}`}>
                Meses sem dado migrado aparecem como "sem dado migrado" e não entram em nenhum cálculo de
                variação. Para corrigir ou completar um mês, use Configurações → Histórico Mensal.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/** Chave do mês anterior ao de referência — usada nos textos auxiliares. */
export function previousMonthKey(year: number, month: number): string {
  const prev = shiftMonth(year, month, -1);
  return toMonthKey(prev.year, prev.month);
}
