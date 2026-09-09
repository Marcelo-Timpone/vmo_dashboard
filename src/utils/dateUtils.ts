import { VmoReferencePeriod } from '../types';

/**
 * Calculates the standard VMO accounting cycle:
 * From Day 02 of the previous month to Day 01 of the current month.
 */
export function calculateVmoReferencePeriod(baseDateInput: Date | string = new Date()): VmoReferencePeriod {
  let baseDate: Date;
  if (typeof baseDateInput === 'string') {
    if (baseDateInput.includes('/')) {
      const parts = baseDateInput.split('/');
      // DD/MM/YYYY
      if (parts.length === 3) {
        baseDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      } else {
        baseDate = new Date();
      }
    } else {
      baseDate = new Date(baseDateInput);
    }
  } else {
    baseDate = baseDateInput;
  }

  if (isNaN(baseDate.getTime())) {
    baseDate = new Date();
  }

  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth(); // 0-indexed (0 = Jan, 8 = Sep)
  const currentDay = baseDate.getDate();

  // If we are on day 1 of the month, the current cycle ends today (day 1 of current month)
  // Previous month date:
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = currentYear - 1;
  }

  // Start Date: Day 02 of previous month
  const startDateObj = new Date(prevYear, prevMonth, 2);
  // End Date: Day 01 of current month
  const endDateObj = new Date(currentYear, currentMonth, 1);

  const formatDate = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const periodLabel = `Ciclo Mensal: ${formatDate(startDateObj)} até ${formatDate(endDateObj)} (Mês Analisado: ${monthNames[prevMonth]}/${prevYear})`;

  const currentDateFormatted = formatDate(baseDate);

  return {
    startDate: formatDate(startDateObj),
    endDate: formatDate(endDateObj),
    currentDate: currentDateFormatted,
    periodLabel
  };
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function parseDateDDMMYYYY(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  return null;
}

export function getReferenceMonthLabel(period?: VmoReferencePeriod): string {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  if (!period) return 'Agosto/2026';

  const startDate = parseDateDDMMYYYY(period.startDate);
  const endDate = parseDateDDMMYYYY(period.endDate);

  if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
    const start = startDate <= endDate ? startDate : endDate;
    const end = startDate <= endDate ? endDate : startDate;

    const monthDays = new Map<string, { month: number; year: number; days: number }>();
    const curr = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const finalDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (curr <= finalDate) {
      const m = curr.getMonth();
      const y = curr.getFullYear();
      const key = `${y}-${m}`;
      const entry = monthDays.get(key) || { month: m, year: y, days: 0 };
      entry.days += 1;
      monthDays.set(key, entry);
      curr.setDate(curr.getDate() + 1);
    }

    let maxDays = -1;
    let dominantMonth = start.getMonth();
    let dominantYear = start.getFullYear();

    for (const item of monthDays.values()) {
      if (item.days > maxDays) {
        maxDays = item.days;
        dominantMonth = item.month;
        dominantYear = item.year;
      }
    }

    return `${monthNames[dominantMonth]}/${dominantYear}`;
  }

  // Fallback if only endDate is available
  if (period.endDate) {
    const parts = period.endDate.split('/');
    if (parts.length === 3) {
      const monthNum = parseInt(parts[1], 10);
      const year = parts[2];
      if (monthNum >= 1 && monthNum <= 12) {
        return `${monthNames[monthNum - 1]}/${year}`;
      }
    }
  }
  return 'Agosto/2026';
}

/**
 * Converte qualquer formato de data (DD/MM/AAAA ou AAAA-MM-DD ou ISO) para objeto Date
 */
export function parseAnyDate(dateStr?: string | null): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const str = dateStr.trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Determina se o projeto deve ser considerado para os gráficos e contêineres do Dashboard:
 * - Projetos com status !== 'ENCERRADO' são sempre considerados (ATIVO ou DEMONSTRATIVO).
 * - Projetos com status === 'ENCERRADO':
 *   - Se não tiver data de encerramento informada: não é considerado para o dash.
 *   - Se tiver data de encerramento informada: só é considerado se a data de referência for ANTES da data de encerramento.
 */
export function isProjectActiveForReferencePeriod(
  project: { status?: 'ATIVO' | 'ENCERRADO' | 'DEMONSTRATIVO'; closureDate?: string },
  referencePeriod: VmoReferencePeriod
): boolean {
  if (project.status === 'ENCERRADO') {
    if (!project.closureDate || !project.closureDate.trim()) {
      return false;
    }
    const closure = parseAnyDate(project.closureDate);
    const ref = parseAnyDate(referencePeriod.endDate) || parseAnyDate(referencePeriod.currentDate);
    if (!closure || !ref) {
      return false;
    }
    // Caso a data de referência seja antes do encerramento, ele é considerado no histórico daquele mês
    return ref.getTime() < closure.getTime();
  }
  return true;
}
