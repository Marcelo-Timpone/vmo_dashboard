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
  onSwitchRole: () => void;
  theme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  session,
  referencePeriod,
  onLogout,
  onSwitchRole,
  theme = 'neon',
  onThemeChange
}) => {
  const isPmo = session?.role === 'pmo';
  const monthLabel = getReferenceMonthLabel(referencePeriod);

  return (
    <header className="sticky top-0 z-40 bg-[#071726] text-white border-b-2 border-[#F26522] shadow-[0_4px_20px_rgba(0,0,0,0.4)] no-print">
      {/* Top Brand Bar */}
      <div className="w-full px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <ExedLogo variant="white" size="md" />
          <span className="text-slate-600 text-sm hidden sm:inline">|</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold tracking-wide text-sm sm:text-base">
              VMO - Relatórios Executivos
            </span>
            <span className="text-[#F26522] font-semibold text-xs sm:text-sm bg-[#0B2240] px-2.5 py-0.5 border border-[#F26522]/30">
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
                  <strong className="text-white font-semibold">{session.username}</strong>
                </div>

                <button
                  type="button"
                  onClick={onSwitchRole}
                  className="px-2.5 py-1 bg-[#0C2442] hover:bg-[#123661] text-slate-200 hover:text-white border border-slate-700 font-medium cursor-pointer transition-colors"
                  title="Alternar perfil de acesso"
                >
                  Alternar para Demonstrativo
                </button>

                {/* Opções de Tema para o Mockup Demonstrativo ao lado do botão Sair */}
                {onThemeChange && (
                  <div className="flex items-center gap-0.5 bg-[#050F1A] p-0.5 border border-slate-700">
                    <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5 hidden md:inline">
                      Tema:
                    </span>
                    <button
                      type="button"
                      onClick={() => onThemeChange('neon')}
                      className={`px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                        theme === 'neon'
                          ? 'bg-[#00D2FF] text-[#06121E]'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Tema Neon Corporativo"
                    >
                      Neon
                    </button>
                    <button
                      type="button"
                      onClick={() => onThemeChange('dark-solid')}
                      className={`px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                        theme === 'dark-solid'
                          ? 'bg-[#F26522] text-white'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Tema Dark com cores sólidas e sem brilho"
                    >
                      Dark Sólido
                    </button>
                    <button
                      type="button"
                      onClick={() => onThemeChange('light')}
                      className={`px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white text-slate-900 font-black'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Tema com fundo branco e cores sólidas"
                    >
                      Branco Limpo
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2.5 py-1 bg-[#F26522]/15 hover:bg-[#F26522] text-[#F26522] hover:text-white border border-[#F26522]/40 font-bold cursor-pointer transition-colors"
                >
                  Sair
                </button>
              </>
            ) : (
              /* Se o usuário for demonstrativo, não exibe usuário nem outras informações dessa linha, apenas o botão de sair */
              <button
                type="button"
                onClick={onLogout}
                className="px-2.5 py-1 bg-[#F26522]/15 hover:bg-[#F26522] text-[#F26522] hover:text-white border border-[#F26522]/40 font-bold cursor-pointer transition-colors"
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
                ? 'border-[#F26522] text-[#F26522] bg-[#0A1C30]'
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
                ? 'border-[#F26522] text-[#F26522] bg-[#0A1C30]'
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
