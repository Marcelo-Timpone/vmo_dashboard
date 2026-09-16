import React, { createContext, useContext, useMemo } from 'react';
import type { CatalogoPortfolio } from '../types';
import { DEFAULT_CATALOGO_PORTFOLIO, rotuloFiltro, rotuloFrente, rotuloSolucao } from '../utils/portfolio';

// Nomes das frentes e soluções configurados pelo PMO, disponíveis para
// qualquer componente sem precisar repassar props.
const CatalogoContext = createContext<CatalogoPortfolio>(DEFAULT_CATALOGO_PORTFOLIO);

export const CatalogoProvider: React.FC<{ value: CatalogoPortfolio; children: React.ReactNode }> = ({
  value,
  children
}) => <CatalogoContext.Provider value={value}>{children}</CatalogoContext.Provider>;

export function useCatalogo() {
  const catalogo = useContext(CatalogoContext);
  return useMemo(
    () => ({
      catalogo,
      solucao: (valor?: string | null) => rotuloSolucao(catalogo, valor),
      frente: (valor?: string | null) => rotuloFrente(catalogo, valor),
      filtro: (valor: string) => rotuloFiltro(catalogo, valor)
    }),
    [catalogo]
  );
}
