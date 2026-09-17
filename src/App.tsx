import React, { useState, useEffect, useRef } from 'react';
import {
  UserSession,
  SapProjectFinancial,
  DashboardWidgetConfig,
  SharePointFolderLink,
  VmoReferencePeriod,
  AppTheme,
  ClientInfo,
  ContainerParamSettings,
  PageLayoutConfig,
  ContainerLayoutConfig,
  MonthlyKpiSnapshot,
  AppStateData,
  ProjetoSemAtualizacao,
  CatalogoPortfolio
} from './types';
import {
  INITIAL_PROJECTS,
  INITIAL_WIDGETS,
  INITIAL_SHAREPOINT_LINKS,
  INITIAL_CLIENTS,
  INITIAL_PAGE_LAYOUT,
  INITIAL_CONTAINER_LAYOUT,
  INITIAL_MONTHLY_HISTORY
} from './data/initialData';
import { DEFAULT_CONTAINER_SETTINGS } from './components/ContainersConfigSection';
import { calculateVmoReferencePeriod } from './utils/dateUtils';
import {
  fetchVmoServerState,
  syncVmoServerState,
  apagarTodosOsDados,
  restaurarBackupCompleto
} from './services/apiService';
import { CatalogoProvider } from './context/CatalogoContext';
import { DEFAULT_CATALOGO_PORTFOLIO, definirCatalogoAtual, normalizarCatalogo } from './utils/portfolio';
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
    return null;
  });

  const [currentTab, setCurrentTab] = useState<'dashboard' | 'configuracao'>('dashboard');

  // Core App Data State (persisted in localStorage)
  const [clients, setClients] = useState<ClientInfo[]>(() => {
    try {
      const isCleared = localStorage.getItem('vmo_exed_clients_cleared');
      if (isCleared === 'true') return [];
      const saved = localStorage.getItem('vmo_exed_clients_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    // Vazio, não a lista de demonstração. Os clientes reais vêm do servidor.
    // INITIAL_CLIENTS só é usado pelo botão "restaurar demonstração".
    return [];
  });

  // Mantidos pelo Claude na migração (somente leitura no webapp, exceto gestores).
  const [projetosSemAtualizacao, setProjetosSemAtualizacao] = useState<ProjetoSemAtualizacao[]>([]);
  // Frentes × soluções (nomes, responsáveis e soluções de cada frente)
  const [catalogoPortfolio, setCatalogoPortfolio] = useState<CatalogoPortfolio>(DEFAULT_CATALOGO_PORTFOLIO);
  definirCatalogoAtual(catalogoPortfolio);
  const [instrucoesServidor, setInstrucoesServidor] = useState<string>('');

  // Controle da sincronização com o servidor (ver comentário mais abaixo).
  const [serverHydrated, setServerHydrated] = useState(false);
  const serverLastSavedRef = useRef<string | null>(null);
  const pularProximaSincronizacaoRef = useRef(false);
  const ultimoPayloadRef = useRef('');

  const [projects, setProjects] = useState<SapProjectFinancial[]>(() => {
    try {
      const isCleared = localStorage.getItem('vmo_exed_projects_cleared');
      if (isCleared === 'true') return [];
      const saved = localStorage.getItem('vmo_exed_projects_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Sem merge com INITIAL_PROJECTS: essa mesclagem completava projetos
        // reais com valores da demonstração (reembolsável 25000, CR 60000),
        // e o número fictício aparecia como se fosse do cliente.
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    // Vazio, não a demonstração. Os projetos reais vêm da migração.
    return [];
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

  const [pageLayout, setPageLayout] = useState<PageLayoutConfig[]>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_page_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_PAGE_LAYOUT;
  });

  const [containerLayout, setContainerLayout] = useState<ContainerLayoutConfig[]>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_container_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CONTAINER_LAYOUT;
  });

  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyKpiSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem('vmo_exed_monthly_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_MONTHLY_HISTORY;
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

  // ---------------------------------------------------------------------------
  // T9 — TEMA FIXO EM 'neon'
  // O seletor de temas saiu da interface. O tipo AppTheme e as ramificações
  // `isLight` espalhadas pelos componentes continuam no código de propósito:
  // são 41 pontos de decisão e arrancar todos agora seria risco de regressão
  // visual sem ganho nenhum. Ficam marcados como CÓDIGO MORTO e a limpeza
  // completa fica para depois da validação da equipe.
  //
  // Enquanto `theme` for a constante abaixo, todo `isLight` avalia false.
  // ---------------------------------------------------------------------------
  const theme: AppTheme = 'neon';

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
      localStorage.setItem('vmo_exed_page_layout', JSON.stringify(pageLayout));
    } catch {
      // ignore
    }
  }, [pageLayout]);

  useEffect(() => {
    try {
      localStorage.setItem('vmo_exed_container_layout', JSON.stringify(containerLayout));
    } catch {
      // ignore
    }
  }, [containerLayout]);

  useEffect(() => {
    try {
      localStorage.setItem('vmo_exed_monthly_history', JSON.stringify(monthlyHistory));
    } catch {
      // ignore
    }
  }, [monthlyHistory]);

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

  // ---------------------------------------------------------------------------
  // SINCRONIZAÇÃO COM O SERVIDOR
  // ---------------------------------------------------------------------------
  // Incidente de 15/09/2026: a sincronização automática enviava a lista vazia
  // guardada no navegador 800 ms depois de abrir a tela, antes de os dados do
  // servidor chegarem, e apagava a migração feita pelo Claude.
  // Agora: (1) nada é enviado antes de o servidor responder; (2) cada envio leva
  // a data da versão carregada e o servidor recusa se ela estiver velha, e a
  // tela recarrega; (3) o que acabou de chegar do servidor não é reenviado.
  const aplicarEstadoDoServidor = (data: any) => {
    // O GET devolve os dados em `dados` (nomes em português) e também na raiz
    // (nomes em inglês). Antes só `dados` era lido, com nomes em inglês, e o
    // histórico mensal e os layouts salvos nunca chegavam à tela.
    const raiz = data || {};
    const d = { ...raiz, ...(raiz.dados || {}) };
      const isCleared = localStorage.getItem('vmo_exed_projects_cleared');
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
        const serverClients = d.clientes || d.clients;
        const isClientsCleared = localStorage.getItem('vmo_exed_clients_cleared');
        if (
          isClientsCleared === 'true' &&
          serverClients.length > 0 &&
          serverClients.every((c: any) => c.status === 'DEMONSTRATIVO' || !c.status)
        ) {
          // Mantém zerado conforme escolha do usuário
        } else {
          setClients(serverClients);
        }
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
      const layoutPaginas = d.layout_paginas || d.pageLayout;
      if (Array.isArray(layoutPaginas) && layoutPaginas.length > 0) {
        setPageLayout(layoutPaginas);
      }
      const layoutConteineres = d.layout_conteineres || d.containerLayout;
      if (Array.isArray(layoutConteineres) && layoutConteineres.length > 0) {
        // Acrescenta contêineres novos que o layout salvo ainda não conhece.
        const idsSalvos = new Set(layoutConteineres.map((c: any) => c.id));
        const novos = INITIAL_CONTAINER_LAYOUT.filter(c => !idsSalvos.has(c.id));
        setContainerLayout([...layoutConteineres, ...novos]);
      }
      const historico = d.historico_mensal || d.monthlyHistory;
      if (Array.isArray(historico)) {
        setMonthlyHistory(historico);
      }
      const period = d.periodo_referencia || d.referencePeriod;
      if (period && typeof period === 'object') {
        setReferencePeriod(period);
      }
      const semAtualizacao = d.projetos_sem_atualizacao || d.projetosSemAtualizacao;
      if (Array.isArray(semAtualizacao)) {
        setProjetosSemAtualizacao(semAtualizacao);
      }
      const catalogo = d.catalogo_portfolio || d.catalogoPortfolio;
      if (catalogo && typeof catalogo === 'object') {
        setCatalogoPortfolio(normalizarCatalogo(catalogo));
      }
      const instrucoes = d.instrucoes_preenchimento || d.instrucoesPreenchimento;
      if (typeof instrucoes === 'string' && instrucoes.trim()) {
        setInstrucoesServidor(instrucoes);
      }
      serverLastSavedRef.current = d.ultima_atualizacao || data?.lastSaved || null;
      pularProximaSincronizacaoRef.current = true;
      setServerHydrated(true);
  };

  const carregarDoServidor = () => {
    fetchVmoServerState()
      .then(res => {
        if (res.success && res.data) {
          aplicarEstadoDoServidor(res.data);
        } else {
          console.warn('[VMO] Dados do servidor indisponíveis; sincronização desligada nesta sessão.', res.error);
        }
      })
      .catch(() => {});
  };

  // Apagar tudo e restaurar backup: o banco executa a operação inteira de uma
  // vez e a tela é recarregada a partir dele (nunca da cópia do navegador).
  const recarregarDoServidorAgora = async (): Promise<boolean> => {
    try {
      const res = await fetchVmoServerState();
      if (res.success && res.data) {
        aplicarEstadoDoServidor(res.data);
        return true;
      }
    } catch {}
    return false;
  };

  const handleApagarTodosOsDados = async (): Promise<{ ok: boolean; mensagem: string }> => {
    const r = await apagarTodosOsDados();
    if (!r.success) {
      return { ok: false, mensagem: `Nada foi apagado: ${r.error || 'falha no servidor'}.` };
    }
    pularProximaSincronizacaoRef.current = true;
    if (r.lastSaved) serverLastSavedRef.current = r.lastSaved;
    try {
      ['vmo_exed_projects_v5', 'vmo_exed_clients_v1', 'vmo_exed_monthly_history'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('vmo_exed_projects_cleared', 'true');
      localStorage.setItem('vmo_exed_clients_cleared', 'true');
    } catch {}
    setProjects([]);
    setClients([]);
    setMonthlyHistory([]);
    setProjetosSemAtualizacao([]);
    const recarregou = await recarregarDoServidorAgora();
    return {
      ok: true,
      mensagem: recarregou
        ? 'Todos os dados foram apagados no banco e nesta tela.'
        : 'Dados apagados no banco. Recarregue a página para atualizar a tela.'
    };
  };

  const handleRestaurarBackup = async (backup: any): Promise<{ ok: boolean; mensagem: string }> => {
    const r = await restaurarBackupCompleto(backup);
    if (!r.success) {
      return { ok: false, mensagem: `Backup não restaurado: ${r.error || 'falha no servidor'}.` };
    }
    if (r.lastSaved) serverLastSavedRef.current = r.lastSaved;
    try {
      localStorage.removeItem('vmo_exed_projects_cleared');
      localStorage.removeItem('vmo_exed_clients_cleared');
    } catch {}
    const recarregou = await recarregarDoServidorAgora();
    const rs = r.resumo;
    const detalhe = rs
      ? `${rs.projetos} projetos, ${rs.clientes} clientes, ${rs.meses_historico} meses de histórico, ${rs.projetos_sem_atualizacao} sem atualização, ${rs.registro_ids} IDs e ${rs.arquivos_migrados} arquivos do log`
      : 'dados do arquivo';
    return {
      ok: recarregou,
      mensagem: recarregou
        ? `Backup restaurado: ${detalhe}.`
        : `Backup restaurado no banco (${detalhe}), mas a tela não recarregou. Atualize a página.`
    };
  };

  // Carregar os dados do servidor (inclusive o que o Claude gravou) ao iniciar
  useEffect(() => {
    carregarDoServidor();
  }, []);

  // Sincronização contínua para o servidor, só depois do primeiro carregamento
  useEffect(() => {
    if (!serverHydrated) return;
    const payload: Partial<AppStateData> = {
      projects,
      clients,
      widgets,
      containerSettings,
      sharePointLinks,
      referencePeriod,
      localDosDados,
      theme,
      pageLayout,
      containerLayout,
      monthlyHistory,
      catalogoPortfolio
    };
    const payloadJson = JSON.stringify(payload);
    if (pularProximaSincronizacaoRef.current) {
      pularProximaSincronizacaoRef.current = false;
      ultimoPayloadRef.current = payloadJson;
      return;
    }
    if (payloadJson === ultimoPayloadRef.current) return;
    const timeout = setTimeout(() => {
      syncVmoServerState(payload, { baseLastSaved: serverLastSavedRef.current })
        .then(res => {
          if (res.success) {
            ultimoPayloadRef.current = payloadJson;
            if (res.lastSaved) serverLastSavedRef.current = res.lastSaved;
          } else if (res.conflict) {
            console.warn('[VMO] Os dados mudaram no servidor; recarregando a versão atual.');
            carregarDoServidor();
          }
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timeout);
  }, [serverHydrated, projects, clients, widgets, containerSettings, sharePointLinks, referencePeriod, localDosDados, theme, pageLayout, containerLayout, monthlyHistory, catalogoPortfolio]);

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
    <CatalogoProvider value={catalogoPortfolio}>
    <div
      className={`${
        isDashboardTab ? 'h-screen overflow-hidden' : 'min-h-screen'
      } flex flex-col ${
        // CÓDIGO MORTO (T9): theme é fixo em 'neon', então este ramo nunca roda.
        theme === 'light' ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#06121E] text-slate-100'
      } selection:bg-exed-accent selection:text-white`}
    >
      {/* Header with official Exed logo, reference month, and role-based tabs */}
      <Header
        currentTab={currentTab}
        onSelectTab={tab => setCurrentTab(tab)}
        session={session}
        referencePeriod={referencePeriod}
        onLogout={handleLogout}
        theme={theme}
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
            pageLayout={pageLayout}
            containerLayout={containerLayout}
            monthlyHistory={monthlyHistory}
            projetosSemAtualizacao={projetosSemAtualizacao}
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
            localDosDados={localDosDados}
            onUpdateLocalDosDados={setLocalDosDados}
            session={session}
            pageLayout={pageLayout}
            containerLayout={containerLayout}
            onUpdatePageLayout={setPageLayout}
            onUpdateContainerLayout={setContainerLayout}
            monthlyHistory={monthlyHistory}
            projetosSemAtualizacao={projetosSemAtualizacao}
            catalogoPortfolio={catalogoPortfolio}
            onUpdateCatalogoPortfolio={setCatalogoPortfolio}
            instrucoesServidor={instrucoesServidor}
            onApagarTodosOsDados={handleApagarTodosOsDados}
            onRestaurarBackup={handleRestaurarBackup}
            onUpdateMonthlyHistory={setMonthlyHistory}
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
    </CatalogoProvider>
  );
}
