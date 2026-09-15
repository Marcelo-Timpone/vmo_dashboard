import React, { useState } from 'react';
import { X, ChevronRight, Menu, Filter, Check } from 'lucide-react';
import { AppTheme, DashboardPageKey, PageLayoutConfig } from '../types';

export type { DashboardPageKey };

export const DASHBOARD_PAGES: { key: DashboardPageKey; label: string }[] = [
  { key: 'one_page', label: 'One page' },
  { key: 'pontos_atencao', label: 'Pontos de atenção' },
  { key: 'informacoes_gerais', label: 'Informações gerais' },
  { key: 'detalhamento_financeiro', label: 'Detalhamento financeiro' }
];

export const FILTER_SOLUTIONS = ['TODOS', 'Fábrica', 'RISE', 'GROW', 'SCP', 'SCE'] as const;
export type FilterSolutionType = (typeof FILTER_SOLUTIONS)[number];

interface LateralControlsProps {
  currentPage: DashboardPageKey;
  onSelectPage: (page: DashboardPageKey) => void;
  selectedFilters: FilterSolutionType[];
  onFilterChange: (filters: FilterSolutionType[]) => void;
  theme?: AppTheme;
  pages?: { key: DashboardPageKey; label: string }[];
}

export const LateralControls: React.FC<LateralControlsProps> = ({
  currentPage,
  onSelectPage,
  selectedFilters,
  onFilterChange,
  theme = 'neon',
  pages = DASHBOARD_PAGES
}) => {
  // Navigation button collapse/expand state
  const [isNavPinned, setIsNavPinned] = useState(true);
  const [isNavHovered, setIsNavHovered] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Filter button collapse/expand state
  const [isFilterPinned, setIsFilterPinned] = useState(true);
  const [isFilterHovered, setIsFilterHovered] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const showNavFull = isNavPinned || isNavHovered;
  const showFilterFull = isFilterPinned || isFilterHovered;

  const isLight = theme === 'light';

  const handleCheckboxToggle = (item: FilterSolutionType) => {
    if (item === 'TODOS') {
      onFilterChange(['TODOS']);
      return;
    }

    // If selecting a specific solution, remove 'TODOS'
    let updated = selectedFilters.filter(f => f !== 'TODOS');
    if (updated.includes(item)) {
      updated = updated.filter(f => f !== item);
    } else {
      updated = [...updated, item];
    }

    // If empty, revert to TODOS
    if (updated.length === 0) {
      updated = ['TODOS'];
    }

    onFilterChange(updated);
  };

  return (
    <div className="fixed left-0 top-32 z-50 flex flex-col gap-2.5 items-start no-print select-none">
      {/* 1. Botão "Menu de navegação" - Sem qualquer brilho/glow */}
      <div
        className="relative"
        onMouseEnter={() => setIsNavHovered(true)}
        onMouseLeave={() => {
          setIsNavHovered(false);
          if (!isNavPinned) setIsNavOpen(false);
        }}
      >
        {!showNavFull ? (
          // Collapsed state: thin solid bar, without glow
          <div
            className="w-1.5 h-10 bg-exed-accent hover:w-2 transition-all cursor-pointer rounded-none"
            title="Menu de navegação (passe o mouse para abrir)"
          />
        ) : (
          // Full button invading the screen - flat solid border, no glow
          <div className="flex items-center shadow-md">
            <button
              type="button"
              onClick={() => setIsNavOpen(!isNavOpen)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors cursor-pointer border-y border-r ${
                isNavOpen
                  ? 'bg-exed-accent text-white border-exed-accent'
                  : isLight
                  ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
                  : 'bg-[#0A1D33] hover:bg-[#0E2847] text-slate-100 border-[#1E436E]'
              }`}
            >
              <Menu size={14} className="text-exed-accent" />
              <span>Menu de navegação</span>
            </button>

            {/* If not pinned, show expand button to pin */}
            {!isNavPinned ? (
              <button
                type="button"
                onClick={() => setIsNavPinned(true)}
                title="Fixar botão na tela"
                className={`px-2 py-2 text-xs border-y border-r cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-slate-800 hover:bg-exed-accent text-slate-300 hover:text-white border-slate-700'
                    : 'bg-[#0A1D33] hover:bg-exed-accent text-slate-400 hover:text-white border-[#1E436E]'
                }`}
              >
                <ChevronRight size={13} />
              </button>
            ) : (
              // If pinned, show 'X' to shrink to line
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsNavPinned(false);
                  setIsNavOpen(false);
                }}
                title="Minimizar para linha"
                className={`px-2 py-2 text-xs border-y border-r cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-rose-200 border-slate-700'
                    : 'bg-[#0A1D33] hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border-[#1E436E]'
                }`}
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Popover container with 4 navigation buttons */}
        {isNavOpen && showNavFull && (
          <div className={`absolute left-full top-0 ml-2 w-56 p-2 shadow-2xl flex flex-col gap-1.5 z-50 border ${
            isLight
              ? 'bg-white border-slate-300 text-slate-800'
              : 'bg-[#081728] border-[#1E436E] text-slate-100'
          }`}>
            <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border-b ${
              isLight ? 'text-slate-500 border-slate-200' : 'text-slate-400 border-slate-800'
            }`}>
              Ir para a página:
            </div>
            {pages.map(page => {
              const active = currentPage === page.key;
              return (
                <button
                  key={page.key}
                  type="button"
                  onClick={() => {
                    onSelectPage(page.key);
                    setIsNavOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-none transition-colors cursor-pointer flex items-center justify-between ${
                    active
                      ? 'bg-exed-accent text-white'
                      : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      : 'bg-[#0A1D33]/60 hover:bg-[#0E2847] text-slate-200 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{page.label}</span>
                  {active && <Check size={13} className="text-white" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Botão "Filtro" - Sem qualquer brilho/glow */}
      <div
        className="relative"
        onMouseEnter={() => setIsFilterHovered(true)}
        onMouseLeave={() => {
          setIsFilterHovered(false);
          if (!isFilterPinned) setIsFilterOpen(false);
        }}
      >
        {!showFilterFull ? (
          // Collapsed state: thin line, without glow
          <div
            className="w-1.5 h-10 bg-[#00D2FF] hover:w-2 transition-all cursor-pointer rounded-none"
            title="Filtro (passe o mouse para abrir)"
          />
        ) : (
          // Full button invading the screen - flat solid border, no glow
          <div className="flex items-center shadow-md">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors cursor-pointer border-y border-r ${
                isFilterOpen
                  ? 'bg-[#00D2FF] text-[#06121E] border-[#00D2FF]'
                  : isLight
                  ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
                  : 'bg-[#0A1D33] hover:bg-[#0E2847] text-slate-100 border-[#1E436E]'
              }`}
            >
              <Filter size={14} className={isFilterOpen ? 'text-[#06121E]' : 'text-[#00D2FF]'} />
              <span>Filtro</span>
              {!selectedFilters.includes('TODOS') && (
                <span className="bg-exed-accent text-white text-[10px] px-1.5 py-0.2 font-mono">
                  {selectedFilters.length}
                </span>
              )}
            </button>

            {/* If not pinned, show expand button to pin */}
            {!isFilterPinned ? (
              <button
                type="button"
                onClick={() => setIsFilterPinned(true)}
                title="Fixar botão na tela"
                className={`px-2 py-2 text-xs border-y border-r cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-slate-800 hover:bg-[#00D2FF] text-slate-300 hover:text-slate-900 border-slate-700'
                    : 'bg-[#0A1D33] hover:bg-[#00D2FF] text-slate-400 hover:text-[#06121E] px-2 py-2 border-[#1E436E]'
                }`}
              >
                <ChevronRight size={13} />
              </button>
            ) : (
              // If pinned, show 'X' to shrink to line
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsFilterPinned(false);
                  setIsFilterOpen(false);
                }}
                title="Minimizar para linha"
                className={`px-2 py-2 text-xs border-y border-r cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-rose-200 border-slate-700'
                    : 'bg-[#0A1D33] hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border-[#1E436E]'
                }`}
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Popover container with 6 checkboxes */}
        {isFilterOpen && showFilterFull && (
          <div className={`absolute left-full top-0 ml-2 w-56 p-3 shadow-2xl flex flex-col gap-2 z-50 border ${
            isLight
              ? 'bg-white border-slate-300 text-slate-800'
              : 'bg-[#081728] border-[#1E436E] text-slate-100'
          }`}>
            <div className={`text-[10px] font-bold uppercase tracking-wider pb-1.5 border-b flex justify-between items-center ${
              isLight ? 'text-slate-600 border-slate-200' : 'text-slate-400 border-slate-800'
            }`}>
              <span>Filtro de Solução SAP</span>
              <span className="text-[9px] text-[#00D2FF]">Multi-seleção</span>
            </div>

            <div className="space-y-1.5">
              {FILTER_SOLUTIONS.map(sol => {
                const isChecked = selectedFilters.includes(sol);
                return (
                  <label
                    key={sol}
                    onClick={() => handleCheckboxToggle(sol)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? isLight
                          ? 'bg-sky-50 text-sky-900 font-semibold border-l-2 border-[#00D2FF]'
                          : 'bg-[#0E2847] text-white font-semibold border-l-2 border-[#00D2FF]'
                        : isLight
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-300 hover:bg-[#0A1D33]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by label click
                      className="cursor-pointer accent-[#00D2FF]"
                    />
                    <span>{sol}</span>
                    {sol === 'TODOS' && (
                      <span className={`text-[9px] ml-auto font-normal ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        Exclusivo
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className={`pt-2 border-t flex justify-between items-center text-[10px] ${
              isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
            }`}>
              <span>Filtra as páginas</span>
              <button
                type="button"
                onClick={() => onFilterChange(['TODOS'])}
                className="text-[#00D2FF] hover:underline cursor-pointer bg-transparent border-none font-bold"
              >
                Resetar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
