// ==============================================================================
// CORES DA MARCA PARA CONTEXTOS FORA DO CSS DO APP
// ==============================================================================
// O token oficial vive em src/index.css (--exed-accent). Este módulo existe só
// para os casos em que uma variável CSS NÃO resolve:
//
//   - o HTML gerado pela exportação de PDF/PPT, que é um documento separado e
//     não herda o :root do app;
//   - qualquer lugar que precise do valor como string JavaScript.
//
// A leitura é feita em tempo de execução a partir do próprio token, então
// trocar o amarelo no index.css continua sendo uma alteração de UMA linha —
// a exportação acompanha sozinha. O fallback só entra em SSR/teste, onde não
// existe `document`.
// ==============================================================================

const FALLBACK_ACCENT = '#FFB81C'; // espelha o valor provisório do index.css
const FALLBACK_BLUE = '#0B2240';

function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

/** Amarelo/destaque da marca, lido de --exed-accent. */
export function getBrandAccent(): string {
  return readToken('--exed-accent', FALLBACK_ACCENT);
}

/** Azul institucional, lido de --exed-brand-blue. */
export function getBrandBlue(): string {
  return readToken('--exed-brand-blue', FALLBACK_BLUE);
}
