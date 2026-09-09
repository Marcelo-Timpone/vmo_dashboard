import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SapProjectFinancial, VmoReferencePeriod, AppTheme, ContainerParamSettings } from '../types';
import { exportToPdf, exportToPpt } from '../utils/exportUtils';
import { isProjectActiveForReferencePeriod } from '../utils/dateUtils';
import {
  LateralControls,
  DashboardPageKey,
  DASHBOARD_PAGES,
  FilterSolutionType
} from './LateralControls';
import { OnePageDashboard } from './OnePageDashboard';
import { AttentionPointsDashboard } from './AttentionPointsDashboard';
import { GeneralInfoDashboard } from './GeneralInfoDashboard';
import { DetailedFinancialDashboard } from './DetailedFinancialDashboard';
import { EmptyPagePlaceholder } from './EmptyPagePlaceholder';
import { FileDown, Presentation, Calendar } from 'lucide-react';

interface DashboardViewProps {
  projects: SapProjectFinancial[];
  referencePeriod: VmoReferencePeriod;
  isPmo: boolean;
  theme?: AppTheme;
  containerSettings?: ContainerParamSettings;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  referencePeriod,
  isPmo,
  theme = 'neon',
  containerSettings
}) => {
  // Active page key: 'one_page' | 'pontos_atencao' | 'informacoes_gerais' | 'detalhamento_financeiro'
  const [currentPage, setCurrentPage] = useState<DashboardPageKey>('one_page');
  const [slideDirection, setSlideDirection] = useState<'down' | 'up'>('down');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Selected filters from lateral control
  const [selectedFilters, setSelectedFilters] = useState<FilterSolutionType[]>(['TODOS']);

  // Wheel streak counters & stage scroll ref
  // Requirement: Change page ONLY by keyboard arrows, navigation menu, OR 2 consecutive scrolls at the boundary!
  const bottomStreak = useRef<number>(0);
  const topStreak = useRef<number>(0);
  const lastBoundaryWheelTime = useRef<number>(0);
  const noticeTimerRef = useRef<any>(null);

  // Visual feedback when user scrolls at the boundary
  const [boundaryNotice, setBoundaryNotice] = useState<{
    direction: 'down' | 'up';
    count: number;
    max: number;
  } | null>(null);

  // Floating notice for export buttons ("Em desenvolvimento")
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const exportNoticeTimerRef = useRef<any>(null);

  const handleExportDevClick = () => {
    if (exportNoticeTimerRef.current) clearTimeout(exportNoticeTimerRef.current);
    setExportNotice('Em desenvolvimento');
    exportNoticeTimerRef.current = setTimeout(() => {
      setExportNotice(null);
    }, 3000);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const stageScrollRef = useRef<HTMLDivElement>(null);

  const pageIndex = DASHBOARD_PAGES.findIndex(p => p.key === currentPage);

  // Function to navigate between pages
  const goToPageIndex = useCallback(
    (newIndex: number) => {
      if (newIndex < 0 || newIndex >= DASHBOARD_PAGES.length) return;
      if (newIndex === pageIndex) return;

      bottomStreak.current = 0;
      topStreak.current = 0;
      setBoundaryNotice(null);

      setSlideDirection(newIndex > pageIndex ? 'down' : 'up');
      setIsTransitioning(true);
      setCurrentPage(DASHBOARD_PAGES[newIndex].key);

      setTimeout(() => {
        setIsTransitioning(false);
      }, 350);
    },
    [pageIndex]
  );

  // Reset scroll to top on page switch
  useEffect(() => {
    if (stageScrollRef.current) {
      stageScrollRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  // Mouse wheel scroll handler:
  // Normal scroll moves the page.
  // ONLY switches page if user scrolls 3 CONSECUTIVE times after reaching the page limit!
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const el = stageScrollRef.current;
      if (!el) return;

      const isScrollable = el.scrollHeight > el.clientHeight + 4;
      const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
      const isAtTop = el.scrollTop <= 6;

      // If inside content and not at boundary, let natural browser scroll occur
      if (isScrollable) {
        if (e.deltaY > 0 && !isAtBottom) {
          bottomStreak.current = 0;
          setBoundaryNotice(null);
          return;
        }
        if (e.deltaY < 0 && !isAtTop) {
          topStreak.current = 0;
          setBoundaryNotice(null);
          return;
        }
      }

      const now = Date.now();

      // Case 1: At Bottom limit and scrolling DOWN
      if (e.deltaY > 15 && isAtBottom) {
        // Debounce continuous wheel inertia from the same physical gesture (~260ms)
        if (now - lastBoundaryWheelTime.current < 260) {
          return;
        }

        // If user paused for more than 1.8s, restart counter from 1
        if (now - lastBoundaryWheelTime.current > 1800) {
          bottomStreak.current = 1;
        } else {
          bottomStreak.current += 1;
        }
        lastBoundaryWheelTime.current = now;

        if (pageIndex < DASHBOARD_PAGES.length - 1) {
          if (bottomStreak.current >= 2) {
            bottomStreak.current = 0;
            setBoundaryNotice(null);
            goToPageIndex(pageIndex + 1);
          } else {
            setBoundaryNotice({
              direction: 'down',
              count: bottomStreak.current,
              max: 2
            });
            clearTimeout(noticeTimerRef.current);
            noticeTimerRef.current = setTimeout(() => {
              setBoundaryNotice(null);
              bottomStreak.current = 0;
            }, 1800);
          }
        }
      } else if (e.deltaY < -15) {
        // User scrolled up, cancel bottom streak
        bottomStreak.current = 0;
      }

      // Case 2: At Top limit and scrolling UP
      if (e.deltaY < -15 && isAtTop) {
        if (now - lastBoundaryWheelTime.current < 260) {
          return;
        }

        if (now - lastBoundaryWheelTime.current > 1800) {
          topStreak.current = 1;
        } else {
          topStreak.current += 1;
        }
        lastBoundaryWheelTime.current = now;

        if (pageIndex > 0) {
          if (topStreak.current >= 2) {
            topStreak.current = 0;
            setBoundaryNotice(null);
            goToPageIndex(pageIndex - 1);
          } else {
            setBoundaryNotice({
              direction: 'up',
              count: topStreak.current,
              max: 2
            });
            clearTimeout(noticeTimerRef.current);
            noticeTimerRef.current = setTimeout(() => {
              setBoundaryNotice(null);
              topStreak.current = 0;
            }, 1800);
          }
        }
      } else if (e.deltaY > 15) {
        // User scrolled down, cancel top streak
        topStreak.current = 0;
      }
    },
    [pageIndex, goToPageIndex]
  );

  // Keyboard navigation:
  // ArrowRight / ArrowLeft -> Direct page change
  // ArrowDown / PageDown -> Change page if at bottom boundary
  // ArrowUp / PageUp -> Change page if at top boundary
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const el = stageScrollRef.current;
      const isAtBottom = el ? el.scrollTop + el.clientHeight >= el.scrollHeight - 6 : true;
      const isAtTop = el ? el.scrollTop <= 6 : true;

      // Horizontal arrows: immediate slide transition
      if (e.key === 'ArrowRight') {
        if (pageIndex < DASHBOARD_PAGES.length - 1) {
          e.preventDefault();
          goToPageIndex(pageIndex + 1);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        if (pageIndex > 0) {
          e.preventDefault();
          goToPageIndex(pageIndex - 1);
        }
        return;
      }

      // Vertical arrows: switch page only when boundary reached
      if ((e.key === 'ArrowDown' || e.key === 'PageDown') && isAtBottom) {
        if (pageIndex < DASHBOARD_PAGES.length - 1) {
          e.preventDefault();
          goToPageIndex(pageIndex + 1);
        }
      } else if ((e.key === 'ArrowUp' || e.key === 'PageUp') && isAtTop) {
        if (pageIndex > 0) {
          e.preventDefault();
          goToPageIndex(pageIndex - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageIndex, goToPageIndex]);

  // Filter projects for dashboard:
  // "projetos encerrados não são considerados para o dash, mesmo mantendo-se no webapp caso a data de referência seja antes do encerramento"
  const dashboardProjects = useMemo(() => {
    return projects.filter(p => isProjectActiveForReferencePeriod(p, referencePeriod));
  }, [projects, referencePeriod]);

  // Render current page content
  const renderCurrentPageContent = () => {
    switch (currentPage) {
      case 'one_page':
        return (
          <div className="w-full">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="text-white font-extrabold text-sm tracking-wide">ONE PAGE</span>
            </div>
            <OnePageDashboard
              projects={dashboardProjects}
              selectedFilters={selectedFilters}
              theme={theme}
              containerSettings={containerSettings}
            />
          </div>
        );

      case 'pontos_atencao':
        return (
          <div className="w-full">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="text-white font-extrabold text-sm tracking-wide">PONTOS DE ATENÇÃO</span>
            </div>
            <AttentionPointsDashboard
              projects={dashboardProjects}
              selectedFilters={selectedFilters}
              theme={theme}
              containerSettings={containerSettings}
            />
          </div>
        );

      case 'informacoes_gerais':
        return (
          <div className="w-full">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="text-white font-extrabold text-sm tracking-wide">INFORMAÇÕES GERAIS</span>
            </div>
            <GeneralInfoDashboard
              projects={dashboardProjects}
              selectedFilters={selectedFilters}
              theme={theme}
              containerSettings={containerSettings}
            />
          </div>
        );

      case 'detalhamento_financeiro':
        return (
          <div className="w-full h-full">
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between border-b pb-1.5 ${
              isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
            }`}>
              <span className="font-extrabold text-sm tracking-wide" style={{ color: isLight ? '#0F172A' : '#FFFFFF' }}>
                DETALHAMENTO FINANCEIRO CONSOLIDADO
              </span>
            </div>
            <DetailedFinancialDashboard
              projects={dashboardProjects}
              selectedFilters={selectedFilters}
              theme={theme}
            />
          </div>
        );
    }
  };

  const isLight = theme === 'light';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={`relative w-full h-full flex flex-col justify-start select-text overflow-hidden min-h-0 ${
        isLight ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#06121E] text-slate-100'
      }`}
      id="vmo-page-dashboard"
    >
      {/* Fixed Lateral Controls (Menu de navegação + Filtro 6 checkboxes) */}
      <LateralControls
        currentPage={currentPage}
        onSelectPage={page => goToPageIndex(DASHBOARD_PAGES.findIndex(p => p.key === page))}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        theme={theme}
      />

      {/* Right Edge Floating Page Indicator Dots */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 items-center no-print">
        {DASHBOARD_PAGES.map((page, idx) => {
          const isActive = idx === pageIndex;
          return (
            <button
              key={page.key}
              type="button"
              onClick={() => goToPageIndex(idx)}
              className="group relative flex items-center justify-center cursor-pointer p-1 bg-transparent border-none"
              title={`${page.label} (Página ${idx + 1})`}
            >
              <span
                className={`transition-all rounded-full ${
                  isActive
                    ? 'w-3 h-3 bg-[#F26522]'
                    : 'w-2 h-2 bg-slate-600 hover:bg-slate-400'
                }`}
              />
              {/* Tooltip label on hover */}
              <span className="absolute right-6 opacity-0 group-hover:opacity-100 transition-opacity bg-[#06121E] border border-slate-700 text-slate-200 text-[10px] font-semibold px-2 py-0.5 whitespace-nowrap pointer-events-none shadow-lg">
                {page.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* PMO Toolbar Container: ONLY visible to PMO */}
      {isPmo && (
        <div className={`w-full shrink-0 p-2 mb-1.5 flex flex-wrap items-center justify-between gap-3 text-xs border no-print ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
            : 'bg-[#091B2E] border-[#16385C] shadow-[0_4px_15px_rgba(0,0,0,0.3)]'
        }`}>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[#F26522]" />
            <span className={`font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Data de Referência:</span>
            <span className={`font-mono font-bold px-2.5 py-0.5 border ${
              isLight
                ? 'bg-slate-50 text-[#F26522] border-slate-200'
                : 'bg-[#06121E] text-[#F26522] border-[#F26522]/30'
            }`}>
              {referencePeriod.startDate} até {referencePeriod.endDate}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportDevClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-bold cursor-pointer text-xs transition-colors border ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-[#0C2442] hover:bg-[#123661] text-slate-100 hover:text-white border-slate-700'
              }`}
              title="Exportar em PDF"
            >
              <FileDown size={13} className="text-[#00D2FF]" />
              <span>Exportar em PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportDevClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F26522] hover:bg-orange-600 text-white font-bold cursor-pointer border-none text-xs transition-colors"
              title="Exportar em PPT"
            >
              <Presentation size={13} className="text-white" />
              <span>Exportar em PPT</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Notice: "Em desenvolvimento" for PDF/PPT export buttons */}
      {exportNotice && (
        <div
          className={`fixed z-50 top-14 left-1/2 -translate-x-1/2 px-4 py-2 border text-xs font-bold no-print shadow-xl transition-all ${
            isLight
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-[#0B2240] text-[#F26522] border-[#F26522]'
          }`}
        >
          {exportNotice}
        </div>
      )}

      {/* Full Page Stage Container: ONLY scrollable container */}
      <div
        ref={stageScrollRef}
        className="flex-1 w-full relative overflow-y-auto pr-1 scroll-smooth min-h-0"
      >
        <div
          key={currentPage}
          className={`w-full transition-all duration-300 ease-out transform ${
            isTransitioning
              ? slideDirection === 'down'
                ? 'opacity-0 translate-y-4'
                : 'opacity-0 -translate-y-4'
              : 'opacity-100 translate-y-0'
          }`}
        >
          {renderCurrentPageContent()}
        </div>
      </div>

      {/* Floating Notice: Visual feedback for 2-consecutive scroll limit (sem animação e sem glow) */}
      {boundaryNotice && (
        <div
          className={`fixed z-50 left-1/2 -translate-x-1/2 px-4 py-2 border text-xs font-semibold no-print ${
            boundaryNotice.direction === 'down' ? 'bottom-5' : 'top-16'
          } ${
            isLight
              ? 'bg-slate-900 text-white border-slate-700 shadow-md'
              : 'bg-[#0B2240] text-slate-100 border-slate-600 shadow-md'
          }`}
        >
          <span>
            {boundaryNotice.direction === 'down'
              ? 'Role mais uma vez para avançar para a próxima página'
              : 'Role mais uma vez para recuar para a página anterior'}
          </span>
        </div>
      )}
    </div>
  );
};
