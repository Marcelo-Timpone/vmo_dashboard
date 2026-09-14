import React from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import { PageLayoutConfig, ContainerLayoutConfig, DashboardPageKey } from '../types';

interface LayoutConfigSectionProps {
  pageLayout: PageLayoutConfig[];
  containerLayout: ContainerLayoutConfig[];
  onUpdatePageLayout: (layout: PageLayoutConfig[]) => void;
  onUpdateContainerLayout: (layout: ContainerLayoutConfig[]) => void;
}

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
  return copy.map((item, idx) => ({ ...item, order: idx }));
}

export const LayoutConfigSection: React.FC<LayoutConfigSectionProps> = ({
  pageLayout,
  containerLayout,
  onUpdatePageLayout,
  onUpdateContainerLayout
}) => {
  const sortedPages = [...pageLayout].sort((a, b) => a.order - b.order);

  const movePage = (index: number, direction: -1 | 1) => {
    onUpdatePageLayout(moveItem(sortedPages, index, direction));
  };

  const togglePageHidden = (key: DashboardPageKey) => {
    onUpdatePageLayout(pageLayout.map(p => (p.key === key ? { ...p, hidden: !p.hidden } : p)));
  };

  const moveContainer = (pageKey: DashboardPageKey, index: number, direction: -1 | 1) => {
    const pageContainers = containerLayout
      .filter(c => c.pageKey === pageKey)
      .sort((a, b) => a.order - b.order);
    const reordered = moveItem(pageContainers, index, direction);
    const others = containerLayout.filter(c => c.pageKey !== pageKey);
    onUpdateContainerLayout([...others, ...reordered]);
  };

  const toggleContainerHidden = (id: string) => {
    onUpdateContainerLayout(containerLayout.map(c => (c.id === id ? { ...c, hidden: !c.hidden } : c)));
  };

  return (
    <div className="bg-white border border-slate-300 p-4 space-y-5" id="layout-config-panel">
      <div className="p-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200">
        Use as setas para reordenar. O ícone de olho controla a visibilidade: quando{' '}
        <strong>oculto</strong>, a página ou o contêiner deixa de aparecer para usuários com
        perfil demonstrativo — mas continua visível para usuários PMO (com um aviso).
      </div>

      {/* Páginas */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Páginas do Dashboard</h3>
        <div className="border border-slate-200 divide-y divide-slate-200">
          {sortedPages.map((page, index) => (
            <div key={page.key} className="p-2.5 flex items-center justify-between gap-2 bg-white">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 w-5">{index + 1}.</span>
                <span className={`text-xs font-bold ${page.hidden ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                  {page.label}
                </span>
                {page.hidden && (
                  <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-300 px-1.5 py-0.5">
                    Oculta (só PMO vê)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => movePage(index, -1)}
                  disabled={index === 0}
                  className="p-1.5 border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Mover para cima"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => movePage(index, 1)}
                  disabled={index === sortedPages.length - 1}
                  className="p-1.5 border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Mover para baixo"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => togglePageHidden(page.key)}
                  className={`p-1.5 border cursor-pointer ${
                    page.hidden
                      ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-600'
                  }`}
                  title={page.hidden ? 'Tornar visível para todos' : 'Ocultar (só PMO verá)'}
                >
                  {page.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contêineres, agrupados por página */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Contêineres por Página</h3>
        <div className="space-y-3">
          {sortedPages.map(page => {
            const pageContainers = containerLayout
              .filter(c => c.pageKey === page.key)
              .sort((a, b) => a.order - b.order);
            if (pageContainers.length === 0) return null;

            return (
              <div key={page.key} className="border border-slate-200">
                <div className="px-2.5 py-1.5 bg-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  {page.label}
                </div>
                <div className="divide-y divide-slate-200">
                  {pageContainers.map((container, index) => (
                    <div key={container.id} className="p-2.5 flex items-center justify-between gap-2 bg-white">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400 w-5">{index + 1}.</span>
                        <span className={`text-xs font-semibold ${container.hidden ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {container.label}
                        </span>
                        {container.hidden && (
                          <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-300 px-1.5 py-0.5">
                            Oculto (só PMO vê)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveContainer(page.key, index, -1)}
                          disabled={index === 0}
                          className="p-1.5 border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          title="Mover para cima"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveContainer(page.key, index, 1)}
                          disabled={index === pageContainers.length - 1}
                          className="p-1.5 border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          title="Mover para baixo"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleContainerHidden(container.id)}
                          className={`p-1.5 border cursor-pointer ${
                            container.hidden
                              ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-600'
                          }`}
                          title={container.hidden ? 'Tornar visível para todos' : 'Ocultar (só PMO verá)'}
                        >
                          {container.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
