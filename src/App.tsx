import React, { useState, useEffect } from 'react';
import {
  UserSession,
  SapProjectFinancial,
  DashboardWidgetConfig,
  SharePointFolderLink,
  VmoReferencePeriod,
  AppTheme,
  ClientInfo,
  ContainerParamSettings
} from './types';
import {
  INITIAL_PROJECTS,
  INITIAL_WIDGETS,
  INITIAL_SHAREPOINT_LINKS,
  INITIAL_CLIENTS
} from './data/initialData';
import { DEFAULT_CONTAINER_SETTINGS } from './components/ContainersConfigSection';
import { calculateVmoReferencePeriod } from './utils/dateUtils';
import { fetchVmoServerState, syncVmoServerState } from './services/apiService';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoginPage } from './components/LoginPage';
import { DashboardView } from './components/DashboardView';
import { ConfigurationView } from './components/ConfigurationView';

export default function App() {
  // Session State: Stored in localStorage.
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_session');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      username: 'demonstrativo@exedconsulting.com',
      role: 'demonstrativo',
      token: 'vmo_jwt_demonstrativo_session',
      loginTime: '09:00',
      expiresInMinutes: 60
    };
  });

  const [currentTab, setCurrentTab] = useState<'dashboard' | 'configuracao'>('dashboard');

  // Core App Data State (persisted in localStorage)
  const [clients, setClients] = useState<ClientInfo[]>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_clients_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 15) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CLIENTS;
  });

  const [projects, setProjects] = useState<SapProjectFinancial[]>(() => {
    try {
      const isCleared = localStorage.getItem('vmo_exed_projects_cleared');
      if (isCleared === 'true') return [];
      const saved = localStorage.getItem('vmo_exed_projects_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return [];
          return parsed.map((p: any) => {
            const initial = INITIAL_PROJECTS.find(init => init.id === p.id);
            return {
              ...initial,
              ...p,
              reimbursableExpenseTotal: p.reimbursableExpenseTotal ?? initial?.reimbursableExpenseTotal ?? 25000,
              crValue: p.hasOpenCr ? (p.crValue ?? initial?.crValue ?? 60000) : undefined
            };
          });
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_PROJECTS;
  });

  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_widgets');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_WIDGETS;
  });

  const [containerSettings, setContainerSettings] = useState<ContainerParamSettings>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_container_settings');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_CONTAINER_SETTINGS;
  });

  const [sharePointLinks, setSharePointLinks] = useState<SharePointFolderLink[]>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_sharepoint_links');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length === 3 &&
          parsed[0]?.url?.includes('IgAL_GSIJkN1SLKiy0lkPJ8VAYZIctQ0c5Okvath-9ajSd0')
        ) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_SHAREPOINT_LINKS;
  });

  const [referencePeriod, setReferencePeriod] = useState<VmoReferencePeriod>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_reference_period');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return calculateVmoReferencePeriod(new Date());
  });

  // Local dos dados (Link do SharePoint para Migração)
  const [localDosDados, setLocalDosDados] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vmo_migration_data_location');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return '';
  });

  // App theme state: 'neon' | 'dark-solid' | 'light'
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_theme');
      if (saved && (saved === 'neon' || saved === 'dark-solid' || saved === 'light')) {
        return saved as AppTheme;
      }
    } catch {
      // ignore
    }
    return 'neon';
  });

  useEffect(() => {
    try {
      localStorage.setItem('vmo_exed_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Local persistence sync
  useEffect(() => {
    try {
      localStorage.setItem('vmo_exed_clients_v1', JSON.stringify(clients));
    } catch {
      // ignore
    }
  }, [clients]);

  useEffect(() => {
    try {
      localStorage.setItem('vmo_exed_projects_v5', JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem('vmo_exed_widgets', JSON.stringify(widgets));
    } catch {
      // ignore
    }
  }, [widgets]);

  useEffect(() => {
    try {
      localStorage.setItem('vmo_exed_container_settings', JSON.stringify(containerSettings));
    } catch {
      // ignore
    }
  }, [containerSettings]);

  useEffect(() => {
    try {
      localStorage.setItem('vmo_exed_sharepoint_links', JSON.stringify(sharePointLinks));
    } catch {
      // ignore
    }
  }, [sharePointLinks]);

  useEffect(() => {
    try {
      localStorage.setItem('vmo_exed_reference_period', JSON.stringify(referencePeriod));
    } catch {
      // ignore
    }
  }, [referencePeriod]);

  useEffect(() => {
    try {
      localStorage.setItem('vmo_migration_data_location', localDosDados);
    } catch {
      // ignore
    }
  }, [localDosDados]);

  // Carregar dados atualizados do servidor (atualizações feitas pelo Claude) ao iniciar
  useEffect(() => {
    fetchVmoServerState()
      .then(res => {
        if (res.success && res.data) {
          const isCleared = localStorage.getItem('vmo_exed_projects_cleared');
          const d = res.data.dados || res.data;
          if (Array.isArray(d.projetos || d.projects)) {
            const serverProjects = d.projetos || d.projects;
            if (
              isCleared === 'true' &&
              serverProjects.length > 0 &&
              serverProjects.every((p: any) => p.status === 'DEMONSTRATIVO' || !p.status)
            ) {
              // Mantém zerado conforme escolha do usuário
            } else {
              setProjects(serverProjects);
            }
          }
          if (Array.isArray(d.clientes || d.clients)) {
            setClients(d.clientes || d.clients);
          }
          if (Array.isArray(d.links_sharepoint || d.sharePointLinks)) {
            const sLinks = d.links_sharepoint || d.sharePointLinks;
            if (sLinks.length === 3) {
              setSharePointLinks(sLinks);
            }
          }
          const link = d.local_dos_dados || d.LOCAL_DOS_DADOS || d.localDosDados;
          if (link) {
            setLocalDosDados(link);
          }
          const containers = d.configuracao_conteineres || d.containerSettings;
          if (containers && typeof containers === 'object') {
            setContainerSettings(containers);
          }
          const period = d.periodo_referencia || d.referencePeriod;
          if (period && typeof period === 'object') {
            setReferencePeriod(period);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Sincronização contínua do estado para o servidor para que o Claude veja em tempo real
  useEffect(() => {
    const timeout = setTimeout(() => {
      syncVmoServerState({
        projects,
        clients,
        widgets,
        containerSettings,
        sharePointLinks,
        referencePeriod,
        localDosDados,
        theme
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timeout);
  }, [projects, clients, widgets, containerSettings, sharePointLinks, referencePeriod, localDosDados, theme]);

  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem('vmo_exed_session', JSON.stringify(session));
      } else {
        localStorage.removeItem('vmo_exed_session');
      }
    } catch {
      // ignore
    }
  }, [session]);

  // When switching role to demonstrativo, ensure currentTab is forced to dashboard
  useEffect(() => {
    if (session?.role !== 'pmo' && currentTab !== 'dashboard') {
      setCurrentTab('dashboard');
    }
  }, [session?.role, currentTab]);

  const handleLogin = (newSession: UserSession) => {
    setSession(newSession);
    setCurrentTab('dashboard');
  };

  const handleLogout = () => {
    setSession(null);
    setCurrentTab('dashboard');
  };

  const handleSwitchRole = () => {
    if (!session) return;
    const newRole = session.role === 'pmo' ? 'demonstrativo' : 'pmo';
    setSession({
      ...session,
      role: newRole,
      username: newRole === 'pmo' ? 'PMO@exedconsulting.com' : 'demonstrativo@exedconsulting.com'
    });
    if (newRole !== 'pmo') {
      setCurrentTab('dashboard');
    }
  };

  const handleRestoreDefaults = () => {
    localStorage.removeItem('vmo_exed_container_settings');
    localStorage.removeItem('vmo_exed_projects_cleared');
    setProjects(INITIAL_PROJECTS);
    setClients(INITIAL_CLIENTS);
    setWidgets(INITIAL_WIDGETS);
    setContainerSettings(DEFAULT_CONTAINER_SETTINGS);
    setSharePointLinks(INITIAL_SHAREPOINT_LINKS);
    setReferencePeriod(calculateVmoReferencePeriod(new Date()));
  };

  // If no session exists, render the isolated LoginPage
  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isPmo = session.role === 'pmo';
  const isDashboardTab = currentTab === 'dashboard';

  return (
    <div
      className={`${
        isDashboardTab ? 'h-screen overflow-hidden' : 'min-h-screen'
      } flex flex-col ${
        theme === 'light' ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#06121E] text-slate-100'
      } selection:bg-[#F26522] selection:text-white`}
    >
      {/* Header with official Exed logo, reference month, and role-based tabs */}
      <Header
        currentTab={currentTab}
        onSelectTab={tab => setCurrentTab(tab)}
        session={session}
        referencePeriod={referencePeriod}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Main Content Area */}
      <main
        className={`w-full px-3 sm:px-4 py-2 flex-1 flex flex-col ${
          isDashboardTab ? 'overflow-hidden min-h-0' : 'overflow-x-hidden'
        }`}
      >
        {currentTab === 'dashboard' && (
          <DashboardView
            projects={projects}
            referencePeriod={referencePeriod}
            isPmo={isPmo}
            theme={theme}
            containerSettings={containerSettings}
          />
        )}

        {/* If user is PMO, they can access configuration */}
        {currentTab === 'configuracao' && isPmo && (
          <ConfigurationView
            projects={projects}
            widgets={widgets}
            sharePointLinks={sharePointLinks}
            referencePeriod={referencePeriod}
            clients={clients}
            containerSettings={containerSettings}
            onUpdateProjects={setProjects}
            onUpdateWidgets={setWidgets}
            onUpdateContainerSettings={setContainerSettings}
            onUpdateSharePointLinks={setSharePointLinks}
            onUpdateReferencePeriod={setReferencePeriod}
            onUpdateClients={setClients}
            onRestoreDefaults={handleRestoreDefaults}
            theme={theme}
            onThemeChange={setTheme}
            localDosDados={localDosDados}
            onUpdateLocalDosDados={setLocalDosDados}
          />
        )}

        {/* Security boundary: If a non-PMO user somehow lands on an unauthorized tab, render a blank area */}
        {!isPmo && currentTab !== 'dashboard' && (
          <div className="flex-1 w-full min-h-[500px] bg-[#06121E]" id="unauthorized-blank-screen" />
        )}
      </main>

      {/* Footer with Exed Logo and VMO Corporativo */}
      <Footer />
    </div>
  );
}
