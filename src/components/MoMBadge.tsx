import React from 'react';
import { AppTheme } from '../types';
import { MonthlyDelta, MONTH_FULL, isFavorable } from '../utils/monthlyComparison';

// ==============================================================================
// BADGE DE VARIAÇÃO MÊS A MÊS
// ==============================================================================
// Usado por TODAS as páginas do dashboard, para que o mesmo número seja lido da
// mesma forma em qualquer lugar do app.
//
// Se `delta` for null o componente não renderiza NADA. Isso é intencional: um
// comparativo sem base é um comparativo que não existe.
// ==============================================================================

export type MoMTone = 'positivo' | 'negativo' | 'neutro';

interface MoMBadgeProps {
  delta: MonthlyDelta | null;
  /** Texto já formatado (ex: '+8.4%', '-1.2 p.p.', '+2'). */
  text: string;
  /** false quando subir é ruim: gasto, atraso, CR em aberto. */
  higherIsBetter?: boolean;
  /** Ignora a lógica de cor e força um tom neutro (métricas sem "lado bom"). */
  neutral?: boolean;
  theme?: AppTheme;
  /** Sufixo do rótulo. Padrão: 'vs mês ant.' */
  suffix?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const idx = Number(month) - 1;
  return MONTH_FULL[idx] ? `${MONTH_FULL[idx]}/${year}` : monthKey;
}

export const MoMBadge: React.FC<MoMBadgeProps> = ({
  delta,
  text,
  higherIsBetter = true,
  neutral = false,
  theme = 'neon',
  suffix = 'vs mês ant.',
  size = 'xs',
  className = ''
}) => {
  // Sem dado dos dois meses → nada é desenhado.
  if (!delta) return null;

  const isLight = theme === 'light';
  const favorable = isFavorable(delta, higherIsBetter);

  const toneClasses = neutral
    ? isLight
      ? 'text-slate-600 bg-slate-100 border-slate-300'
      : 'text-slate-300 bg-slate-500/10 border-slate-600'
    : favorable
    ? isLight
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/30'
    : isLight
    ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-[#FF3366] bg-[#FF3366]/10 border-[#FF3366]/30';

  const sizeClasses = size === 'xs' ? 'text-[9px] px-1 py-0.2' : 'text-[10px] px-1.5 py-0.5';

  return (
    <span
      className={`font-semibold border whitespace-nowrap ${sizeClasses} ${toneClasses} ${className}`}
      title={`${monthLabel(delta.currentMonthKey)} comparado a ${monthLabel(delta.previousMonthKey)}`}
    >
      {text}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
};

/**
 * Espaço reservado para quando o comparativo não pode ser calculado.
 * Mostra "—" com a explicação no title, em vez de sumir silenciosamente —
 * assim o PMO entende que falta migrar o mês, e não que a variação foi zero.
 */
export const MoMEmpty: React.FC<{ theme?: AppTheme; reason?: string; className?: string }> = ({
  theme = 'neon',
  reason = 'Sem histórico do mês anterior para comparar.',
  className = ''
}) => {
  const isLight = theme === 'light';
  return (
    <span
      className={`text-[9px] font-semibold px-1 py-0.2 border whitespace-nowrap ${
        isLight ? 'text-slate-400 bg-slate-50 border-slate-200' : 'text-slate-500 bg-slate-500/5 border-slate-700'
      } ${className}`}
      title={reason}
    >
      —
    </span>
  );
};
