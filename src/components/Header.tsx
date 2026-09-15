import React from 'react';
import { ExedLogo } from './ExedLogo';
import { UserSession, VmoReferencePeriod, AppTheme } from '../types';
import { getReferenceMonthLabel } from '../utils/dateUtils';

interface HeaderProps {
  currentTab: 'dashboard' | 'configuracao';
  onSelectTab: (tab: 'dashboard' | 'configuracao') => void;
  session: UserSession | null;
  referencePeriod?: VmoReferencePeriod;
  onLogout: () => void;
  // T9 — o seletor de temas foi removido da interface e o app é fixo em 'neon'.
  // As props continuam aceitas (opcionais) só para não quebrar chamadas
  // existentes; nada no Header as utiliza mais.
  theme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  session,
  referencePeriod,
  onLogout
}) => {
  const isPmo = session?.role === 'pmo';
  const monthLabel = getReferenceMonthLabel(referencePeriod);

  return (
    <header className="sticky top-0 z-40 bg-[#071726] text-white border-b-2 border-exed-accent shadow-[0_4px_20px_rgba(0,0,0,0.4)] no-print">
      {/* Top Brand Bar */}
      <div className="w-full px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <ExedLogo variant="white" size="md" />
          <span className="text-slate-600 text-sm hidden sm:inline">|</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold tracking-wide text-sm sm:text-base">
              VMO - Relatórios Executivos
            </span>
            <span className="text-exed-accent font-semibold text-xs sm:text-sm bg-[#0B2240] px-2.5 py-0.5 border border-exed-accent/30">
              {monthLabel}
            </span>
          </div>
        </div>

        {/* User Session Info & Controls - Clean text without brackets */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {session ? (
            isPmo ? (
              <>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-slate-400">Usuário:</span>
                  <strong className="text-white font-semibold">{session.name || session.username}</strong>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2.5 py-1 bg-exed-accent/15 hover:bg-exed-accent text-exed-accent hover:text-white border border-exed-accent/40 font-bold cursor-pointer transition-colors"
                >
                  Sair
                </button>
              </>
            ) : (
              /* Se o usuário for demonstrativo, não exibe usuário nem outras informações dessa linha, apenas o botão de sair */
              <button
                type="button"
                onClick={onLogout}
                className="px-2.5 py-1 bg-exed-accent/15 hover:bg-exed-accent text-exed-accent hover:text-white border border-exed-accent/40 font-bold cursor-pointer transition-colors"
              >
                Sair
              </button>
            )
          ) : (
            <span className="text-slate-400">Não autenticado</span>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar: ONLY visible if the user is PMO */}
      {isPmo && (
        <nav className="w-full px-4 bg-[#050F1A] border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer border-b-2 ${
              currentTab === 'dashboard'
                ? 'border-exed-accent text-exed-accent bg-[#0A1C30]'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            DASHBOARD
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('configuracao')}
            className={`px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer border-b-2 ${
              currentTab === 'configuracao'
                ? 'border-exed-accent text-exed-accent bg-[#0A1C30]'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            CONFIGURAÇÃO
          </button>
        </nav>
      )}
    </header>
  );
};
