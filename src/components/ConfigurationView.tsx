import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ExternalLink, Copy, Check, ShieldCheck, Key, Terminal } from 'lucide-react';
import {
  SapProjectFinancial,
  DashboardWidgetConfig,
  SharePointFolderLink,
  VmoReferencePeriod,
  AppStateData,
  SolutionType,
  TrafficTag,
  ClientInfo,
  ContainerParamSettings,
  AppTheme,
  ProjectStatus,
  UserSession,
  PageLayoutConfig,
  ContainerLayoutConfig,
  MonthlyKpiSnapshot,
  ProjetoSemAtualizacao,
  CatalogoPortfolio,
  FrenteConfig,
  FrontType
} from '../types';
import { exportStateToJson, exportToExcel, exportToCsv, getJsonExportFilename } from '../utils/exportUtils';
import { calculateVmoReferencePeriod } from '../utils/dateUtils';
import { useCatalogo } from '../context/CatalogoContext';
import {
  DEFAULT_CATALOGO_PORTFOLIO,
  definirFrente,
  frenteEfetiva,
  normalizarCatalogo,
  normalizarFrente,
  normalizarSolucao
} from '../utils/portfolio';
import {
  getStoredApiKey,
  setStoredApiKey,
  testClaudeApiConnection,
  syncVmoServerState,
  hasStoredApiKey,
  obterBackupCompleto,
  ehBackupCompleto
} from '../services/apiService';
import {
  pingAndSyncSupabase,
  getSupabaseConfig,
  saveSupabaseConfig,
  SUPABASE_SQL_INIT_SCRIPT,
  SupabaseUsuarioRow
} from '../services/supabaseService';
import {
  INITIAL_SUPABASE_USERS,
  INITIAL_CLIENTS,
  INITIAL_PROJECTS
} from '../data/initialData';
import { ContainersConfigSection, DEFAULT_CONTAINER_SETTINGS } from './ContainersConfigSection';
import { ClientsConfigSection } from './ClientsConfigSection';
import { UsersConfigSection } from './UsersConfigSection';
import { LayoutConfigSection } from './LayoutConfigSection';
import { MonthlyHistoryConfigSection } from './MonthlyHistoryConfigSection';
import { ClientLogo } from './ClientLogo';

interface ConfigurationViewProps {
  projects: SapProjectFinancial[];
  widgets: DashboardWidgetConfig[];
  sharePointLinks: SharePointFolderLink[];
  referencePeriod: VmoReferencePeriod;
  clients?: ClientInfo[];
  containerSettings?: ContainerParamSettings;
  onUpdateProjects: (projects: SapProjectFinancial[]) => void;
  onUpdateWidgets: (widgets: DashboardWidgetConfig[]) => void;
  onUpdateContainerSettings?: (newSettings: ContainerParamSettings) => void;
  onUpdateSharePointLinks: (links: SharePointFolderLink[]) => void;
  onUpdateReferencePeriod: (period: VmoReferencePeriod) => void;
  onUpdateClients?: (clients: ClientInfo[]) => void;
  onRestoreDefaults: () => void;
  theme?: AppTheme;
  // T9 — tema fixo 'neon'. Prop mantida só por compatibilidade; não é usada.
  onThemeChange?: (theme: AppTheme) => void;
  localDosDados?: string;
  onUpdateLocalDosDados?: (link: string) => void;
  session: UserSession;
  pageLayout: PageLayoutConfig[];
  containerLayout: ContainerLayoutConfig[];
  onUpdatePageLayout: (layout: PageLayoutConfig[]) => void;
  onUpdateContainerLayout: (layout: ContainerLayoutConfig[]) => void;
  monthlyHistory: MonthlyKpiSnapshot[];
  onUpdateMonthlyHistory: (history: MonthlyKpiSnapshot[]) => void;
  projetosSemAtualizacao?: ProjetoSemAtualizacao[];
  catalogoPortfolio?: CatalogoPortfolio;
  onUpdateCatalogoPortfolio?: (catalogo: CatalogoPortfolio) => void;
  /** Instruções gravadas no servidor; têm prioridade sobre a cópia do navegador. */
  instrucoesServidor?: string;
  /** Apaga os dados no banco e na tela (implementado no App). */
  onApagarTodosOsDados?: () => Promise<{ ok: boolean; mensagem: string }>;
  /** Restaura um backup completo no banco e recarrega a tela (implementado no App). */
  onRestaurarBackup?: (backup: any) => Promise<{ ok: boolean; mensagem: string }>;
}

export const DEFAULT_APP_INSTRUCOES = `FONTE DOS DADOS
A única fonte de dados deste webapp é o SharePoint corporativo da Exed, no
caminho configurado em "Local dos dados". Não existe outra origem.

ESTRUTURA
AAAAMM_Mês / AAAAMMDD - Delivery / Dashboard - ... /
AAAAMMDD_PMO RSE_<PORTFOLIO>_<CLIENTE>_<PROJETO>.xlsm

Processe SÓ arquivos com "PMO RSE_" no nome. Cuidado: "PMO RISE_" (com I antes
do S) NÃO é arquivo válido.

LEITURA
Leia a aba "MIRROR ACTUAL" — lista chave-valor das linhas 1 a 1084. Não raspe as
abas visuais: a posição das células muda e a leitura quebra.
Cada arquivo traz DUAS semanas ("MIRROR ACTUAL" e "LAST STATUS"), não o histórico
inteiro — para nove meses é preciso abrir os arquivos dos nove meses.

IDENTIDADE
A identidade do projeto é o "Project ID (S4 Public Exed)" de dentro da planilha,
NUNCA o nome do arquivo (os nomes mudam entre semanas: _v2, _v3...).
O portfólio vem do campo "Project Portfolio" de dentro da planilha — os rótulos
das subpastas ("RISE + FSW", "GROW + DSC") não são confiáveis.

MÊS DE REFERÊNCIA
Confirme pelo campo "Status Date" de dentro da planilha, não pela data da pasta
ou do arquivo.

ESCRITA
substituir_projetos troca o array inteiro: envie sempre a lista completa.
upsert_historico_mensal faz merge por monthKey: seguro para carga incremental.
No histórico mensal, inclua projectSnapshots (um item por projeto, com o Project
ID) — é isso que faz a coluna "Comparativo Mês Ant." ser calculada em vez de
digitada.

REGRA DE OURO
Campo sem dado deve ser OMITIDO, nunca enviado como zero. Zero vira uma variação
real no relatório; ausente vira "—".`;

export const ConfigurationView: React.FC<ConfigurationViewProps> = ({
  projects,
  widgets,
  sharePointLinks,
  referencePeriod,
  clients = INITIAL_CLIENTS,
  containerSettings,
  onUpdateProjects,
  onUpdateWidgets,
  onUpdateContainerSettings = (_newSettings: ContainerParamSettings) => {},
  onUpdateSharePointLinks,
  onUpdateReferencePeriod,
  onUpdateClients = (_clients: ClientInfo[]) => {},
  onRestoreDefaults,
  theme = 'neon',
  localDosDados: propLocalDosDados = '',
  onUpdateLocalDosDados,
  session,
  pageLayout,
  containerLayout,
  onUpdatePageLayout,
  onUpdateContainerLayout,
  monthlyHistory,
  onUpdateMonthlyHistory,
  projetosSemAtualizacao = [] as ProjetoSemAtualizacao[],
  catalogoPortfolio = DEFAULT_CATALOGO_PORTFOLIO,
  onUpdateCatalogoPortfolio = (_catalogo: CatalogoPortfolio) => {},
  instrucoesServidor = '',
  onApagarTodosOsDados = async () => ({ ok: false, mensagem: 'Função indisponível nesta tela.' }),
  onRestaurarBackup = async (_backup: any) => ({ ok: false, mensagem: 'Função indisponível nesta tela.' })
}) => {
  const [activeSection, setActiveSection] = useState<
    'containers' | 'clients' | 'sharepoint' | 'upload' | 'projects' | 'period' | 'migration' | 'demonstrativo' | 'usuarios' | 'layout' | 'historico'
  >('containers');

  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Supabase State & Config
  const [supabaseUsers, setSupabaseUsers] = useState<SupabaseUsuarioRow[]>(() => {
    try {
      const saved = localStorage.getItem('vmo_supabase_users');
      return saved ? JSON.parse(saved) : INITIAL_SUPABASE_USERS;
    } catch {
      return INITIAL_SUPABASE_USERS;
    }
  });

  const [supabaseUrl, setSupabaseUrl] = useState(() => getSupabaseConfig().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => getSupabaseConfig().anonKey);
  const [lastPingTime, setLastPingTime] = useState<string>(() => {
    return localStorage.getItem('vmo_supabase_last_ping') || new Date().toISOString();
  });
  const [isPinging, setIsPinging] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local dos dados (Migração - Link do SharePoint)
  const [migrationLink, setMigrationLink] = useState<string>(() => {
    if (propLocalDosDados) return propLocalDosDados;
    try {
      return localStorage.getItem('vmo_migration_data_location') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (propLocalDosDados !== undefined && propLocalDosDados !== migrationLink) {
      setMigrationLink(propLocalDosDados);
    }
  }, [propLocalDosDados]);

  const handleUpdateMigrationLink = (val: string) => {
    setMigrationLink(val);
    if (onUpdateLocalDosDados) {
      onUpdateLocalDosDados(val);
    }
    try {
      localStorage.setItem('vmo_migration_data_location', val);
    } catch {}
  };

  const handleSaveMigrationLink = () => {
    if (onUpdateLocalDosDados) {
      onUpdateLocalDosDados(migrationLink);
    }
    try {
      localStorage.setItem('vmo_migration_data_location', migrationLink);
    } catch {}
    showNotification('Local dos dados (SharePoint) salvo com sucesso!');
  };

  // Instruções para Preenchimento (Instrução padrão solicitada)
  const [instrucoesPreenchimento, setInstrucoesPreenchimento] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vmo_instrucoes_preenchimento');
      if (saved && saved.trim().length > 0 && !saved.includes('INSTRUÇÕES PARA PREENCHIMENTO E ALIMENTAÇÃO')) {
        return saved;
      }
    } catch {}
    return DEFAULT_APP_INSTRUCOES;
  });

  const handleUpdateInstrucoes = (text: string) => {
    setInstrucoesPreenchimento(text);
    try {
      localStorage.setItem('vmo_instrucoes_preenchimento', text);
    } catch {}
  };

  const handleSaveInstrucoesManual = () => {
    try {
      localStorage.setItem('vmo_instrucoes_preenchimento', instrucoesPreenchimento);
    } catch {}
    syncVmoServerState({ instrucoesPreenchimento });
    showNotification('Instruções para preenchimento salvas com sucesso!');
  };

  // A versão do servidor prevalece: antes, uma cópia antiga guardada no
  // navegador podia sobrescrever o manual atualizado ao clicar em Salvar.
  useEffect(() => {
    if (instrucoesServidor && instrucoesServidor.trim()) {
      setInstrucoesPreenchimento(instrucoesServidor);
      try {
        localStorage.setItem('vmo_instrucoes_preenchimento', instrucoesServidor);
      } catch {}
    }
  }, [instrucoesServidor]);

  // Frentes × soluções: nomes, responsáveis e soluções de cada frente.
  // Quantidades fixas (6 soluções, 5 frentes) para os filtros continuarem valendo.
  const rot = useCatalogo();
  const [catalogoEditavel, setCatalogoEditavel] = useState<CatalogoPortfolio>(catalogoPortfolio);
  const [responsaveisTexto, setResponsaveisTexto] = useState<Record<string, string>>({});
  useEffect(() => {
    setCatalogoEditavel(catalogoPortfolio);
    setResponsaveisTexto(
      Object.fromEntries(catalogoPortfolio.frentes.map(f => [f.key, f.responsaveis.join(', ')]))
    );
  }, [catalogoPortfolio]);

  const renomearSolucao = (key: SolutionType, label: string) => {
    setCatalogoEditavel({
      ...catalogoEditavel,
      solucoes: catalogoEditavel.solucoes.map(sol => (sol.key === key ? { ...sol, label } : sol))
    });
  };

  const atualizarFrente = (key: FrontType, parcial: Partial<FrenteConfig>) => {
    setCatalogoEditavel({
      ...catalogoEditavel,
      frentes: catalogoEditavel.frentes.map(f => (f.key === key ? { ...f, ...parcial } : f))
    });
  };

  const handleSaveCatalogo = () => {
    const comResponsaveis: CatalogoPortfolio = {
      ...catalogoEditavel,
      frentes: catalogoEditavel.frentes.map(f => ({
        ...f,
        responsaveis: (responsaveisTexto[f.key] ?? f.responsaveis.join(', '))
          .split(/[,;]/)
          .map(nome => nome.trim())
          .filter(Boolean)
      }))
    };
    const novoCatalogo = normalizarCatalogo(comResponsaveis);
    onUpdateCatalogoPortfolio(novoCatalogo);
    // Projetos com frente automática acompanham a nova regra do responsável.
    let reclassificados = 0;
    const atualizados = projects.map(proj => {
      if (proj.frontManual) return proj;
      const regra = definirFrente(novoCatalogo, proj.portfolioManager).frente;
      if (!regra || regra === proj.front) return proj;
      reclassificados += 1;
      return { ...proj, front: regra };
    });
    if (reclassificados > 0) onUpdateProjects(atualizados);
    showNotification(
      reclassificados > 0
        ? `Frentes e soluções salvas. ${reclassificados} projeto(s) mudaram de frente pela regra do responsável.`
        : 'Frentes e soluções salvas. Filtros e próximas migrações já usam esta configuração.'
    );
  };

  const alterarProjeto = (id: string, parcial: Partial<SapProjectFinancial>) => {
    onUpdateProjects(projects.map(proj => (proj.id === id ? { ...proj, ...parcial } : proj)));
  };

  // Configuração e Estado da API Corporativa para o Claude
  const [claudeApiKey, setClaudeApiKey] = useState<string>(() => getStoredApiKey());
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [apiTestStatus, setApiTestStatus] = useState<{
    tested: boolean;
    success?: boolean;
    message?: string;
    details?: any;
  } | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  const handleSaveApiKey = () => {
    setStoredApiKey(claudeApiKey);
    showNotification('Chave de API do Claude salva com sucesso!');
  };

  const handleTestClaudeApi = async () => {
    setIsTestingApi(true);
    setApiTestStatus(null);
    try {
      const res = await testClaudeApiConnection(claudeApiKey);
      setApiTestStatus({
        tested: true,
        success: res.success,
        message: res.statusText,
        details: res.details
      });
      if (res.success) {
        showNotification('API validada: O Claude tem acesso completo de leitura e escrita!');
      } else {
        showNotification('Falha na validação da API: ' + res.statusText, true);
      }
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleCopyText = (text: string, type: 'key' | 'endpoint' | 'prompt') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
    } else if (type === 'endpoint') {
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2000);
    } else if (type === 'prompt') {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
    showNotification('Copiado para a área de transferência!');
  };

  // Save users locally
  useEffect(() => {
    localStorage.setItem('vmo_supabase_users', JSON.stringify(supabaseUsers));
  }, [supabaseUsers]);

  // New / Edit Project Form State
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState<Partial<SapProjectFinancial>>({
    code: `EXED-SAP-0${projects.length + 1}`,
    name: '',
    client: '',
    solution: 'RISE',
    projectManager: 'Ricardo Silva',
    status: 'ATIVO',
    closureDate: '',
    budgetPlanned: 1000000,
    budgetRealized: 950000,
    billed: 900000,
    marginPercent: 25.0,
    trafficTag: 'Verde',
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    scheduleDelayPercent: 0,
    signedDocumentsPercent: 95,
    isLegacyDocs: false,
    usesCloudAlm: true,
    npsScore: 9.5,
    hasOpenCr: false,
    crDescription: '',
    plannedResources: 12,
    totalResources: 12,
    resourceVariancePercent: 0,
    sharePointFolder: sharePointLinks[0]?.url || '',
    referenceDate: referencePeriod.endDate,
    notes: ''
  });

  // Prompt Inicial Recomendado para o Claude Corporativo (Editável e com estilos padrão)
  const defaultClaudePrompt = `Você está conectado à API do VMO da Exed Consulting (${typeof window !== 'undefined' ? window.location.origin : ''}/api/vmo/state).

DIRETRIZ MANDATÓRIA:
1. Leia primeiro GET /api/vmo/state e o campo 'INSTRUCOES_PARA_PREENCHIMENTO' por completo.
2. A ÚNICA fonte de dados é o SharePoint corporativo da Exed, na pasta indicada em 'LOCAL_DOS_DADOS'. Não existe outra origem.
3. Processe só arquivos com "PMO RSE_" no nome. Cuidado: "PMO RISE_" (com I antes do S) NÃO é válido.
4. Leia a aba "MIRROR ACTUAL" de cada planilha, não as abas visuais. Cada arquivo traz duas semanas, não o histórico inteiro.
5. A identidade do projeto é o "Project ID (S4 Public Exed)" de dentro da planilha, nunca o nome do arquivo.
6. Confirme o mês pelo "Status Date" de dentro da planilha, não pela data da pasta.
7. Ao escrever: substituir_projetos troca o array inteiro (mande a lista completa); upsert_historico_mensal faz merge por monthKey.
8. Campo sem dado deve ser OMITIDO, nunca enviado como zero.

A chave de acesso é configurada acima nesta tela e deve ser enviada no cabeçalho 'x-api-key'.`;

  const [claudePrompt, setClaudePrompt] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vmo_claude_prompt');
      // Prompts salvos na versão antiga citavam 'Link 1/Link 2' e uma origem
      // de dados que não existe mais — são descartados para forçar o padrão novo.
      if (saved && saved.trim() && !saved.includes('Link 1')) return saved;
    } catch {}
    return defaultClaudePrompt;
  });

  const handleSaveClaudePrompt = () => {
    try {
      localStorage.setItem('vmo_claude_prompt', claudePrompt);
    } catch {}
    showNotification('Prompt do Claude salvo com sucesso!');
  };

  // ---------------------------------------------------------------------------
  // DADOS E BACKUP (substitui os antigos "dados demonstrativos")
  // Apagar e restaurar rodam no banco, em uma operação só; a tela recarrega do
  // servidor. O backup baixado vem do banco, não da cópia do navegador.
  // ---------------------------------------------------------------------------
  const [textoConfirmacaoApagar, setTextoConfirmacaoApagar] = useState('');
  const [apagando, setApagando] = useState(false);
  const [backupPendente, setBackupPendente] = useState<any | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const resumoBackupPendente = (backupPendente?.resumo || {}) as Record<string, number | string | undefined>;

  const formatarDataHora = (valor?: string) => {
    if (!valor) return 'data desconhecida';
    const d = new Date(valor);
    return isNaN(d.getTime()) ? String(valor) : d.toLocaleString('pt-BR');
  };

  const handleApagarTudo = async () => {
    if (textoConfirmacaoApagar.trim().toUpperCase() !== 'APAGAR') {
      showNotification('Digite APAGAR para confirmar.', true);
      return;
    }
    setApagando(true);
    const r = await onApagarTodosOsDados();
    setApagando(false);
    setTextoConfirmacaoApagar('');
    showNotification(r.mensagem, !r.ok);
  };

  const lerArquivoBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(String(evt.target?.result || ''));
        if (ehBackupCompleto(parsed)) {
          setBackupPendente(parsed);
          return;
        }
        showNotification(
          'Este arquivo não é um backup completo (formato vmo-backup). Arquivos antigos entram por Importação e Alimentação de Dados.',
          true
        );
      } catch (err: any) {
        showNotification('Não foi possível ler o arquivo: ' + (err?.message || 'JSON inválido'), true);
      }
    };
    reader.readAsText(file);
  };

  const handleSelecionarBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) lerArquivoBackup(file);
    if (backupInputRef.current) backupInputRef.current.value = '';
  };

  const handleConfirmarRestauracao = async () => {
    if (!backupPendente) return;
    setRestaurando(true);
    const r = await onRestaurarBackup(backupPendente);
    setRestaurando(false);
    if (r.ok) setBackupPendente(null);
    showNotification(r.mensagem, !r.ok);
  };

  const showNotification = (text: string, isError: boolean = false) => {
    setFeedbackMsg({ text, isError });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // 1. SUPABASE ACTIONS & FREE-TIER REACTIVATION
  const handleTriggerSupabasePing = async () => {
    setIsPinging(true);
    try {
      const res = await pingAndSyncSupabase(
        supabaseUsers,
        widgets,
        sharePointLinks,
        referencePeriod
      );
      setLastPingTime(res.timestamp);
      showNotification(res.message);
    } catch (e: any) {
      showNotification('Erro ao comunicar com Supabase: ' + (e?.message || 'Falha de rede'), true);
    } finally {
      setIsPinging(false);
    }
  };

  const handleSaveSupabaseCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    showNotification('Credenciais do Supabase salvas com sucesso.');
    handleTriggerSupabasePing();
  };

  const handleCopySqlScript = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_INIT_SCRIPT);
    setCopiedSql(true);
    showNotification('Script SQL copiado para a área de transferência! Cole no SQL Editor do Supabase.');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // 2. WIDGET ORDERING AND VISIBILITY
  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    const newWidgets = [...widgets];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[targetIndex];
    newWidgets[targetIndex] = temp;

    newWidgets.forEach((w, idx) => {
      w.order = idx + 1;
    });

    onUpdateWidgets(newWidgets);
    showNotification('Ordem dos gráficos atualizada no Dashboard.');
  };

  const toggleWidgetVisibility = (id: string) => {
    const updated = widgets.map(w => (w.id === id ? { ...w, visible: !w.visible } : w));
    onUpdateWidgets(updated);
    showNotification('Visibilidade do componente atualizada.');
  };

  // 3. PROJECT MANAGEMENT (CRUD)
  const handleStartEditProject = (p: SapProjectFinancial) => {
    setEditingProjectId(p.id);
    setNewProject({ ...p });
    const el = document.getElementById('projects-crud-panel');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setNewProject({
      code: `EXED-SAP-0${projects.length + 1}`,
      name: '',
      client: '',
      solution: 'RISE',
      projectManager: 'Ricardo Silva',
      status: 'ATIVO',
      closureDate: '',
      budgetPlanned: 1000000,
      budgetRealized: 950000,
      billed: 900000,
      marginPercent: 25.0,
      trafficTag: 'Verde',
      qaStatus: 'Auditado',
      pendenciesCount: 0,
      scheduleDelayPercent: 0,
      signedDocumentsPercent: 95,
      isLegacyDocs: false,
      usesCloudAlm: true,
      npsScore: 9.5,
      hasOpenCr: false,
      crDescription: '',
      plannedResources: 12,
      totalResources: 12,
      resourceVariancePercent: 0,
      sharePointFolder: sharePointLinks[0]?.url || '',
      referenceDate: referencePeriod.endDate,
      notes: ''
    });
  };

  const handleAddOrUpdateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.client || !newProject.code) {
      showNotification('Preencha código, nome do projeto e cliente.', true);
      return;
    }

    const planned = Number(newProject.budgetPlanned) || 0;
    const realized = Number(newProject.budgetRealized) || 0;
    const variance = planned > 0 ? ((realized - planned) / planned) * 100 : 0;

    const clientMatch = clients.find(
      c =>
        c.name?.toLowerCase() === newProject.client?.toLowerCase() ||
        c.shortName?.toLowerCase() === newProject.client?.toLowerCase() ||
        (newProject.client && c.shortName && newProject.client.toLowerCase().includes(c.shortName.toLowerCase()))
    );

    const projectLogo = clientMatch ? clientMatch.logoUrl : (newProject.clientLogo || '/assets/logos/gerdau.png');
    const projectStatus: ProjectStatus = (newProject.status as ProjectStatus) || 'ATIVO';
    const isDemonstrativo = projectStatus === 'DEMONSTRATIVO';

    // Regra mandatória: quando qualquer dado real é carregado/salvo, automaticamente todos os dados demonstrativos são apagados
    const baseProjects = isDemonstrativo
      ? projects
      : projects.filter(p => p.status !== 'DEMONSTRATIVO');

    if (editingProjectId) {
      // Update existing project
      const updated = baseProjects.map(p => {
        if (p.id === editingProjectId) {
          return {
            ...p,
            ...newProject,
            code: newProject.code!,
            name: newProject.name!,
            client: newProject.client!,
            clientLogo: projectLogo,
            solution: (newProject.solution as SolutionType) || p.solution,
            front:
              newProject.front ||
              definirFrente(catalogoPortfolio, newProject.portfolioManager ?? p.portfolioManager).frente ||
              undefined,
            frontManual:
              !!newProject.front &&
              newProject.front !== definirFrente(catalogoPortfolio, newProject.portfolioManager ?? p.portfolioManager).frente,
            projectManager: newProject.projectManager || p.projectManager,
            status: projectStatus,
            closureDate: projectStatus === 'ENCERRADO' ? (newProject.closureDate || '') : undefined,
            budgetPlanned: planned,
            budgetRealized: realized,
            billed: Number(newProject.billed) || 0,
            costVariancePercent: Number(variance.toFixed(1)),
            marginPercent: Number(newProject.marginPercent) || 0,
            trafficTag: (newProject.trafficTag as TrafficTag) || p.trafficTag,
            qaStatus: newProject.qaStatus || p.qaStatus,
            pendenciesCount: Number(newProject.pendenciesCount) || 0,
            scheduleDelayPercent: Number(newProject.scheduleDelayPercent) || 0,
            signedDocumentsPercent: newProject.isLegacyDocs ? null : (Number(newProject.signedDocumentsPercent) || 0),
            isLegacyDocs: Boolean(newProject.isLegacyDocs),
            usesCloudAlm: Boolean(newProject.usesCloudAlm),
            npsScore: Number(newProject.npsScore) || undefined,
            hasOpenCr: Boolean(newProject.hasOpenCr),
            crValue: newProject.hasOpenCr ? (Number(newProject.crValue) || 0) : undefined,
            crOpenDate: newProject.hasOpenCr ? (newProject.crOpenDate || '') : undefined,
            crDescription: newProject.crDescription || '',
            reimbursableExpenseTotal: Number(newProject.reimbursableExpenseTotal) || 0,
            plannedResources: Number(newProject.plannedResources) || undefined,
            totalResources: Number(newProject.totalResources) || undefined,
            resourceVariancePercent: Number(newProject.resourceVariancePercent) || undefined,
            sharePointFolder: newProject.sharePointFolder || p.sharePointFolder,
            referenceDate: newProject.referenceDate || p.referenceDate,
            notes: newProject.notes || ''
          } as SapProjectFinancial;
        }
        return p;
      });

      onUpdateProjects(updated);
      showNotification(`Projeto ${newProject.code} atualizado com sucesso no dashboard!`);
      handleCancelEdit();
    } else {
      // Create new project
      const created: SapProjectFinancial = {
        id: `proj-${Date.now()}`,
        code: newProject.code!,
        name: newProject.name!,
        client: newProject.client!,
        clientLogo: projectLogo,
        solution: (newProject.solution as SolutionType) || 'RISE',
        front:
          newProject.front ||
          definirFrente(catalogoPortfolio, newProject.portfolioManager).frente ||
          undefined,
        frontManual:
          !!newProject.front && newProject.front !== definirFrente(catalogoPortfolio, newProject.portfolioManager).frente,
        projectManager: newProject.projectManager || '',
        projectIdS4: newProject.projectIdS4 || undefined,
        projectIdMissing: newProject.projectIdS4 ? false : newProject.projectIdMissing,
        portfolioManager: newProject.portfolioManager || undefined,
        status: projectStatus,
        closureDate: projectStatus === 'ENCERRADO' ? (newProject.closureDate || '') : undefined,
        budgetPlanned: planned,
        budgetRealized: realized,
        billed: Number(newProject.billed) || 0,
        costVariancePercent: Number(variance.toFixed(1)),
        marginPercent: Number(newProject.marginPercent) || 20,
        trafficTag: (newProject.trafficTag as TrafficTag) || 'Verde',
        qaStatus: newProject.qaStatus || 'Auditado',
        pendenciesCount: Number(newProject.pendenciesCount) || 0,
        scheduleDelayPercent: Number(newProject.scheduleDelayPercent) || 0,
        signedDocumentsPercent: newProject.isLegacyDocs ? null : (Number(newProject.signedDocumentsPercent) || 95),
        isLegacyDocs: Boolean(newProject.isLegacyDocs),
        usesCloudAlm: Boolean(newProject.usesCloudAlm),
        npsScore: Number(newProject.npsScore) || 9.5,
        hasOpenCr: Boolean(newProject.hasOpenCr),
        crValue: newProject.hasOpenCr ? (Number(newProject.crValue) || 0) : undefined,
        crOpenDate: newProject.hasOpenCr ? (newProject.crOpenDate || '') : undefined,
        crDescription: newProject.crDescription || '',
        reimbursableExpenseTotal: Number(newProject.reimbursableExpenseTotal) || 0,
        plannedResources: Number(newProject.plannedResources) || 12,
        totalResources: Number(newProject.totalResources) || 12,
        resourceVariancePercent: Number(newProject.resourceVariancePercent) || 0,
        sharePointFolder: newProject.sharePointFolder || sharePointLinks[0]?.url || '',
        referenceDate: newProject.referenceDate || referencePeriod.endDate,
        notes: newProject.notes || ''
      };

      onUpdateProjects([...baseProjects, created]);
      showNotification(`Projeto ${created.code} adicionado com sucesso ao dashboard!`);
      handleCancelEdit();
    }
  };

  const handleDeleteProject = (id: string) => {
    onUpdateProjects(projects.filter(p => p.id !== id));
    if (editingProjectId === id) {
      handleCancelEdit();
    }
    showNotification('Projeto removido do dashboard.');
  };

  // 4. SHAREPOINT LINKS MANAGEMENT
  const handleUpdateSharePointLink = (id: string, field: 'label' | 'url' | 'notes', value: string) => {
    const updated = sharePointLinks.map(link =>
      link.id === id ? { ...link, [field]: value } : link
    );
    onUpdateSharePointLinks(updated);
  };

  const handleAddSharePointLink = () => {
    const newLink: SharePointFolderLink = {
      id: `sp-${Date.now()}`,
      label: `Link ${sharePointLinks.length + 1}`,
      url: '',
      isPrimary: false,
      notes: ''
    };
    onUpdateSharePointLinks([...sharePointLinks, newLink]);
    showNotification('Novo link de pasta SharePoint adicionado com sucesso.');
  };

  const handleDeleteSharePointLink = (id: string) => {
    const updated = sharePointLinks.filter(link => link.id !== id);
    onUpdateSharePointLinks(updated);
    showNotification('Link do SharePoint removido com sucesso.');
  };

  // 5. UPLOAD / IMPORT HANDLER (EXCLUSIVELY JASON / JSON WITH FULL WEBAPP STATE AND SUPABASE SYNC)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt !== 'json') {
      showNotification('Apenas arquivos no formato JASON (.json) são permitidos.', true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);

        // Backup completo (formato vmo-backup): restauração integral, com confirmação
        if (ehBackupCompleto(parsed)) {
          setBackupPendente(parsed);
          setActiveSection('demonstrativo');
          showNotification('Backup completo reconhecido. Confira o resumo em Dados e backup e confirme a restauração.');
          return;
        }

        let updatedWidgets = widgets;
        let updatedLinks = sharePointLinks;
        let updatedPeriod = referencePeriod;
        let updatedProjectsList = projects;
        let updatedUsers = supabaseUsers;

        // 1. Restore INSTRUÇÕES PARA PREENCHIMENTO
        const importedInstructions =
          parsed.INSTRUCOES_PARA_PREENCHIMENTO ??
          parsed.instrucoes_para_preenchimento ??
          parsed.instrucoes ??
          parsed.dados_aplicacao?.instrucoes_preenchimento;
        if (typeof importedInstructions === 'string') {
          setInstrucoesPreenchimento(importedInstructions);
          try {
            localStorage.setItem('vmo_instrucoes_preenchimento', importedInstructions);
          } catch {}
        }

        // Restore Local dos Dados (Migração - SharePoint)
        const importedMigrationLink =
          parsed.local_dos_dados ||
          parsed.localDosDados ||
          parsed.dados_aplicacao?.local_dos_dados;
        if (typeof importedMigrationLink === 'string') {
          handleUpdateMigrationLink(importedMigrationLink);
        }

        // 2. Restore Clients & Logos
        const importedClients =
          parsed.clients ||
          parsed.dados_aplicacao?.clientes_e_logos ||
          parsed.dados_aplicacao?.clientes;
        if (Array.isArray(importedClients) && importedClients.length > 0) {
          onUpdateClients(importedClients);
          try {
            localStorage.setItem('vmo_exed_clients_v1', JSON.stringify(importedClients));
          } catch {}
        }

        // 3. Restore Container Settings
        const importedContainers =
          parsed.containerSettings ||
          parsed.dados_aplicacao?.configuracoes_conteineres ||
          parsed.dados_aplicacao?.containers_config;
        if (importedContainers && typeof importedContainers === 'object') {
          onUpdateContainerSettings(importedContainers);
          try {
            localStorage.setItem('vmo_exed_container_settings', JSON.stringify(importedContainers));
          } catch {}
        }

        // 4. Tema — T9: o app é fixo em 'neon'. Um backup antigo pode trazer
        // 'light' ou 'dark-solid'; o valor é ignorado de propósito para que
        // restaurar um backup não reintroduza um tema que saiu da interface.
        const importedTheme = parsed.theme || parsed.dados_aplicacao?.configuracoes_gerais?.tema;
        if (importedTheme && importedTheme !== 'neon') {
          console.info(
            `[VMO] Tema "${importedTheme}" no backup foi ignorado: o app usa tema fixo Neon.`
          );
        }

        // 5. Restore Supabase Users
        if (parsed.usuarios && Array.isArray(parsed.usuarios)) {
          updatedUsers = parsed.usuarios;
          setSupabaseUsers(parsed.usuarios);
        }

        // 6. Restore Widgets
        const rawWidgets =
          parsed.widgets ||
          parsed.dados_aplicacao?.graficos_dashboard ||
          parsed.dados_aplicacao?.graficos ||
          parsed.configuracao_graficos;
        if (Array.isArray(rawWidgets) && rawWidgets.length > 0) {
          updatedWidgets = rawWidgets.map((cg: any, idx: number) => ({
            id: cg.id || `widget-${idx}`,
            title: cg.title || `Gráfico ${idx + 1}`,
            type: cg.type,
            order: cg.order_num || cg.order || idx + 1,
            visible: cg.visible !== false,
            collapsed: Boolean(cg.collapsed),
            filterSolutions: cg.filterSolutions,
            filterTraffic: cg.filterTraffic
          }));
          onUpdateWidgets(updatedWidgets);
          try {
            localStorage.setItem('vmo_exed_widgets', JSON.stringify(updatedWidgets));
          } catch {}
        }

        // 7. Restore SharePoint Links
        const rawLinks =
          parsed.sharePointLinks ||
          parsed.dados_aplicacao?.links_sharepoint ||
          parsed.links;
        if (Array.isArray(rawLinks) && rawLinks.length > 0) {
          updatedLinks = rawLinks.map((l: any, idx: number) => ({
            id: l.id || `sp-${Date.now()}-${idx}`,
            label: l.label || `Pasta SharePoint ${idx + 1}`,
            url: l.url || '',
            isPrimary: Boolean(l.is_primary ?? l.isPrimary),
            notes: l.notes || ''
          }));
          onUpdateSharePointLinks(updatedLinks);
          try {
            localStorage.setItem('vmo_exed_sharepoint_links', JSON.stringify(updatedLinks));
          } catch {}
        }

        // 8. Restore Reference Period (sem periodLabel)
        const rawPeriod =
          parsed.referencePeriod ||
          parsed.dados_aplicacao?.periodo_referencia ||
          parsed.data_referencia;
        if (rawPeriod) {
          updatedPeriod = {
            startDate: rawPeriod.startDate || rawPeriod.start_date || referencePeriod.startDate,
            endDate: rawPeriod.endDate || rawPeriod.end_date || referencePeriod.endDate,
            currentDate: rawPeriod.currentDate || rawPeriod.current_date || referencePeriod.currentDate
          };
          onUpdateReferencePeriod(updatedPeriod);
          try {
            localStorage.setItem('vmo_exed_reference_period', JSON.stringify(updatedPeriod));
          } catch {}
        }

        // 9. Restore Projects
        const rawProjects =
          parsed.projects ||
          parsed.dados_aplicacao?.projetos ||
          (Array.isArray(parsed) ? parsed : null);
        if (Array.isArray(rawProjects) && rawProjects.length > 0) {
          // Quando qualquer dado real é carregado, automaticamente todos os dados demonstrativos são apagados
          const hasRealProjects = rawProjects.some((p: any) => p.status && p.status !== 'DEMONSTRATIVO');
          const finalProjects = hasRealProjects
            ? rawProjects.filter((p: any) => p.status !== 'DEMONSTRATIVO')
            : rawProjects;
          updatedProjectsList = finalProjects;
          onUpdateProjects(finalProjects);
          try {
            localStorage.setItem('vmo_exed_projects_v5', JSON.stringify(finalProjects));
          } catch {}
        }

        // Trigger Supabase Keep-Alive Ping and Synchronization in background
        try {
          const syncResult = await pingAndSyncSupabase(
            updatedUsers,
            updatedWidgets,
            updatedLinks,
            updatedPeriod
          );
          setLastPingTime(syncResult.timestamp);
        } catch {}

        showNotification(
          'Arquivo JASON carregado com sucesso! Todas as configurações e dados foram restaurados.'
        );
      } catch (err: any) {
        showNotification('Erro ao processar arquivo JASON: ' + (err?.message || 'Formato inválido'), true);
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 6. BACKUP COMPLETO (JSON) — gerado pelo banco, com todos os dados
  const handleDownloadJsonWithReactivation = async () => {
    const r = await obterBackupCompleto();
    if (!r.success || !r.backup) {
      showNotification(`Não foi possível gerar o backup: ${r.error || 'erro desconhecido'}.`, true);
      return;
    }
    const blob = new Blob([JSON.stringify(r.backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const carimbo = String(r.backup.gerado_em || new Date().toISOString()).slice(0, 16).replace(/[-:T]/g, '');
    link.href = url;
    link.download = `vmo-backup-${carimbo}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    // Mantém o ping de atividade do Supabase que existia no download antigo
    try {
      await pingAndSyncSupabase(supabaseUsers, widgets, sharePointLinks, referencePeriod);
      setLastPingTime(new Date().toISOString());
    } catch {}

    const rs = r.backup.resumo || {};
    showNotification(
      `Backup baixado: ${rs.projetos ?? 0} projetos, ${rs.clientes ?? 0} clientes, ${rs.meses_historico ?? 0} meses de histórico, ${rs.projetos_sem_atualizacao ?? 0} sem atualização, ${rs.registro_ids ?? 0} IDs e ${rs.arquivos_migrados ?? 0} arquivos do log.`
    );
  };

  // Reference Period Update
  const handleCalculateDateFromCurrent = (currDate: string) => {
    const calculated = calculateVmoReferencePeriod(currDate);
    onUpdateReferencePeriod(calculated);
    showNotification(`Período contábil recalculado: ${calculated.startDate} até ${calculated.endDate}`);
  };

  return (
    <div className="w-full space-y-4 pb-8 select-text" id="vmo-configuration-module">
      {/* Top Banner Notice */}
      <div className="bg-[#0B2240] text-white p-3 border-l-4 border-exed-accent flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
        <div>
          <div className="font-bold text-sm tracking-wide">
            Painel de Configuração PMO
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadJsonWithReactivation}
            className="px-3 py-1.5 bg-exed-accent hover:bg-exed-accent-strong text-white font-bold cursor-pointer border-none text-xs transition-colors"
            title="Baixar arquivo JASON com todas as informações do webapp"
          >
            Baixar JASON Completo
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {feedbackMsg && (
        <div
          className={`p-3 text-xs font-semibold flex justify-between items-center ${
            feedbackMsg.isError
              ? 'bg-rose-100 border border-rose-400 text-rose-900'
              : 'bg-emerald-100 border border-emerald-400 text-emerald-900'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="font-bold cursor-pointer bg-transparent border-none ml-3 text-xs"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="bg-white border border-slate-300 p-1 flex flex-wrap gap-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveSection('containers')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'containers'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          CONFIGURAÇÕES INDIVIDUAIS DOS CONTÊINERES
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('clients')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'clients'
              ? 'bg-[#00D2FF] text-[#0B2240] border-[#00D2FF]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          CLIENTES & LOGOS
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('projects')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'projects'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          GESTÃO DE PROJETOS SAP
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('sharepoint')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'sharepoint'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          PASTAS E LINKS SHAREPOINT
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('upload')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'upload'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          IMPORTAÇÃO E ALIMENTAÇÃO DE DADOS
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('period')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'period'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          DATA DE REFERÊNCIA CONTÁBIL
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('migration')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'migration'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          MIGRAÇÃO E API
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('demonstrativo')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'demonstrativo'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          DADOS E BACKUP
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('usuarios')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'usuarios'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          USUÁRIOS
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('layout')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'layout'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          LAYOUT DO DASHBOARD
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('historico')}
          className={`px-3 py-1.5 font-bold cursor-pointer border ${
            activeSection === 'historico'
              ? 'bg-[#0B2240] text-white border-[#0B2240]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          HISTÓRICO MENSAL
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 0: CONTAINERS INDIVIDUAL CONFIGURATION (PMO)                       */}
      {/* ========================================================================= */}
      {activeSection === 'containers' && (
        <ContainersConfigSection
          projects={projects}
          settings={containerSettings || DEFAULT_CONTAINER_SETTINGS}
          onUpdateSettings={onUpdateContainerSettings}
        />
      )}

      {/* ========================================================================= */}
      {/* SECTION 0.5: CLIENTS & LOGOS MANAGEMENT (PMO)                             */}
      {/* ========================================================================= */}
      {activeSection === 'clients' && (
        <ClientsConfigSection
          clients={clients}
          onUpdateClients={onUpdateClients}
          projects={projects}
          onUpdateProjects={onUpdateProjects}
          onShowMessage={(m, err) => showNotification(m, err)}
        />
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: SHAREPOINT LINKS MANAGEMENT */}
      {/* ========================================================================= */}
      {activeSection === 'sharepoint' && (
        <div className="bg-white border border-slate-300 p-4 text-xs space-y-4" id="sharepoint-config-panel">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <div>
              <div className="font-bold text-sm text-[#0B2240] uppercase tracking-wide">
                Links de Pastas do SharePoint
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddSharePointLink}
              className="px-3 py-1.5 bg-[#0B2240] hover:bg-exed-accent text-white font-bold cursor-pointer border-none text-xs transition-colors flex items-center gap-1.5"
            >
              + Adicionar Link
            </button>
          </div>

          <div className="space-y-3">
            {sharePointLinks.length === 0 ? (
              <div className="p-6 text-center text-slate-500 border border-dashed border-slate-300">
                Nenhum link cadastrado. Clique no botão acima para adicionar links de pastas.
              </div>
            ) : (
              sharePointLinks.map((link, idx) => (
                <div key={link.id} className="p-3 bg-slate-50 border border-slate-300 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-slate-800 text-xs">
                      Link {idx + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSharePointLink(link.id)}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 hover:border-rose-600 text-xs font-semibold cursor-pointer transition-colors"
                      title="Excluir este link"
                    >
                      Excluir Link
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Identificação:
                      </label>
                      <input
                        type="text"
                        value={link.label}
                        onChange={e => handleUpdateSharePointLink(link.id, 'label', e.target.value)}
                        className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                        placeholder=""
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        URL:
                      </label>
                      <input
                        type="url"
                        value={link.url}
                        onChange={e => handleUpdateSharePointLink(link.id, 'url', e.target.value)}
                        className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                        placeholder=""
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Finalidade:
                    </label>
                    <input
                      type="text"
                      value={link.notes}
                      onChange={e => handleUpdateSharePointLink(link.id, 'notes', e.target.value)}
                      className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                      placeholder=""
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: UPLOAD & IMPORT */}
      {/* ========================================================================= */}
      {activeSection === 'upload' && (
        <div className="bg-white border border-slate-300 p-4 text-xs space-y-4" id="upload-config-panel">
          <div className="font-bold text-sm text-[#0B2240] uppercase tracking-wide border-b border-slate-200 pb-2">
            Importação e Alimentação de Dados
          </div>

          {/* Campo Largo: INSTRUÇÕES PARA PREENCHIMENTO */}
          <div className="border border-slate-300 p-4 bg-slate-50 space-y-2">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <label
                  htmlFor="campo-instrucoes-preenchimento"
                  className="block font-bold text-xs uppercase tracking-wider text-[#0B2240]"
                >
                  INSTRUÇÕES PARA PREENCHIMENTO
                </label>
              </div>
              <button
                type="button"
                onClick={handleSaveInstrucoesManual}
                className="px-3 py-1.5 bg-[#0B2240] hover:bg-exed-accent text-white font-bold cursor-pointer border-none text-xs transition-colors self-start sm:self-auto"
              >
                Salvar Instruções
              </button>
            </div>
            <textarea
              id="campo-instrucoes-preenchimento"
              value={instrucoesPreenchimento}
              onChange={e => handleUpdateInstrucoes(e.target.value)}
              placeholder=""
              className="w-full min-h-[160px] p-3 text-xs font-mono bg-white text-slate-900 border border-slate-300 focus:outline-none focus:border-exed-accent focus:ring-1 focus:ring-exed-accent leading-relaxed resize-y"
            />
          </div>

          <p className="text-[11px] text-slate-600">
            Frentes, soluções e responsáveis ficam em Gestão de projetos SAP. O Claude usa essa configuração para classificar cada projeto na migração.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-slate-300 p-6 text-center bg-slate-50 space-y-3 flex flex-col justify-center items-center">
              <div className="font-bold text-slate-800 text-sm">
                Carregar Arquivo JASON
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json,application/json"
                className="hidden"
                id="hidden-file-input"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[#0B2240] hover:bg-exed-accent text-white font-bold cursor-pointer border-none text-xs transition-colors"
              >
                Selecionar Arquivo JASON
              </button>
              <p className="text-[10px] text-slate-500 max-w-xs">
                Backups completos (formato vmo-backup) são reconhecidos e seguem para Dados e backup, onde você confirma a restauração.
              </p>
            </div>

            {/* Export Area */}
            <div className="border border-slate-200 p-4 bg-slate-50 space-y-3">
              <div className="font-bold text-slate-800 text-sm">
                Baixar Estado Completo
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadJsonWithReactivation}
                  className="px-4 py-2 bg-exed-accent hover:bg-exed-accent-strong text-white font-bold cursor-pointer border-none text-xs transition-colors text-left"
                >
                  Baixar JASON Completo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: SAP PROJECTS MANAGEMENT (CRUD) */}
      {/* ========================================================================= */}
      {activeSection === 'projects' && (
        <div className="bg-white border border-slate-300 p-4 text-xs space-y-4" id="projects-crud-panel">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <div className="font-bold text-sm text-[#0B2240] uppercase tracking-wide">
                {editingProjectId ? `Editar Projeto SAP (${newProject.code})` : `Adicionar Novo Projeto SAP à Base`}
              </div>
              {editingProjectId && (
                <div className="text-[11px] text-slate-500">
                  Modifique os parâmetros do projeto. As alterações refletirão imediatamente em todos os 6 contêineres do dashboard.
                </div>
              )}
            </div>
            {editingProjectId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs border border-slate-300 cursor-pointer"
              >
                Cancelar Edição
              </button>
            )}
          </div>

          {/* Frentes × soluções: catálogo editável pelo PMO (quantidades fixas) */}
          <div className="border border-slate-300 bg-slate-50 p-3 space-y-3" id="catalogo-frentes-solucoes">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Frentes e soluções</h4>
                <p className="text-[11px] text-slate-600 max-w-3xl">
                  A solução vem do campo Project Portfolio da RSE. A frente é definida por projeto: a regra usa o gerente de portfólio responsável, e você pode mover qualquer projeto de frente. Projetos da mesma solução podem estar em frentes diferentes. São sempre 6 soluções e 5 frentes; renomeie à vontade e os filtros acompanham.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveCatalogo}
                className="px-3 py-1.5 bg-[#0B2240] hover:bg-exed-accent text-white font-bold cursor-pointer border-none text-xs transition-colors"
              >
                Salvar frentes e soluções
              </button>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-700 mb-1">Soluções</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {catalogoEditavel.solucoes.map(sol => (
                  <label key={sol.key} className="block">
                    <span className="block text-[10px] font-mono text-slate-500 mb-0.5">{sol.key}</span>
                    <input
                      type="text"
                      value={sol.label}
                      onChange={e => renomearSolucao(sol.key, e.target.value)}
                      aria-label={`Nome da solução ${sol.key}`}
                      className="w-full p-1 border border-slate-300 text-xs bg-white text-slate-900"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-700 mb-1">Frentes</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="p-1.5 border border-slate-200 text-left">Frente</th>
                      <th className="p-1.5 border border-slate-200 text-left">Responsável (gerente de portfólio)</th>
                      <th className="p-1.5 border border-slate-200 text-left">Projetos da frente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogoEditavel.frentes.map(f => (
                      <tr key={f.key}>
                        <td className="p-1.5 border border-slate-200 align-top">
                          <input
                            type="text"
                            value={f.label}
                            onChange={e => atualizarFrente(f.key, { label: e.target.value })}
                            aria-label={`Nome da frente ${f.key}`}
                            className="w-full min-w-[110px] p-1 border border-slate-300 text-xs bg-white text-slate-900"
                          />
                        </td>
                        <td className="p-1.5 border border-slate-200 align-top">
                          <input
                            type="text"
                            value={responsaveisTexto[f.key] ?? f.responsaveis.join(', ')}
                            onChange={e => setResponsaveisTexto({ ...responsaveisTexto, [f.key]: e.target.value })}
                            placeholder="Nome como aparece na RSE"
                            aria-label={`Responsáveis pela frente ${f.label}`}
                            className="w-full min-w-[180px] p-1 border border-slate-300 text-xs bg-white text-slate-900"
                          />
                          <span className="block text-[10px] text-slate-500 mt-0.5">Separe mais de um nome por vírgula.</span>
                        </td>
                        <td className="p-1.5 border border-slate-200 align-top">
                          {(() => {
                            const daFrente = projects.filter(proj => frenteEfetiva(proj, catalogoPortfolio) === f.key);
                            const deOutras = projects.filter(proj => frenteEfetiva(proj, catalogoPortfolio) !== f.key);
                            return (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1">
                                  {daFrente.length === 0 && (
                                    <span className="text-[11px] text-slate-500">Nenhum projeto nesta frente.</span>
                                  )}
                                  {daFrente.map(proj => (
                                    <span
                                      key={proj.id}
                                      title={`${proj.client}, solução ${rot.solucao(proj.solution)}`}
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] border ${
                                        proj.frontManual
                                          ? 'bg-sky-50 text-sky-900 border-sky-200'
                                          : 'bg-white text-slate-700 border-dashed border-slate-400'
                                      }`}
                                    >
                                      {proj.name}
                                      <span className="font-mono text-slate-500">{rot.solucao(proj.solution)}</span>
                                    </span>
                                  ))}
                                </div>
                                {deOutras.length > 0 && (
                                  <select
                                    value=""
                                    onChange={e => {
                                      if (e.target.value) alterarProjeto(e.target.value, { front: f.key, frontManual: true });
                                    }}
                                    aria-label={`Mover projeto para a frente ${f.label}`}
                                    className="w-full max-w-xs p-1 border border-slate-300 text-[11px] bg-white text-slate-700"
                                  >
                                    <option value="">Mover projeto para esta frente…</option>
                                    {deOutras.map(proj => (
                                      <option key={proj.id} value={proj.id}>
                                        {proj.name} (hoje: {rot.frente(frenteEfetiva(proj, catalogoPortfolio))})
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[10px] text-slate-500">
              Borda contínua: frente fixada pelo PMO, mantida nas próximas migrações. Borda tracejada: frente automática, pelo gerente de portfólio responsável.
            </p>

            {projetosSemAtualizacao.length > 0 && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2">
                {projetosSemAtualizacao.length === 1
                  ? '1 projeto aguarda a atualização da RSE pelo GP.'
                  : `${projetosSemAtualizacao.length} projetos aguardam a atualização da RSE pelo GP.`}{' '}
                A lista está em Pontos de Atenção.
              </p>
            )}
          </div>

          <form onSubmit={handleAddOrUpdateProject} className="p-3 bg-slate-50 border border-slate-300 space-y-3">
            {/* Bloco 1: Identificação */}
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Código Projeto:</label>
                <input
                  type="text"
                  value={newProject.code || ''}
                  onChange={e => setNewProject({ ...newProject, code: e.target.value })}
                  placeholder="EXED-SAP-016"
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nome do Projeto:</label>
                <input
                  type="text"
                  value={newProject.name || ''}
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Ex: Transformação S/4HANA Cloud"
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cliente:</label>
                <input
                  type="text"
                  list="client-suggestions"
                  value={newProject.client || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const matched = clients.find(c => c.name?.toLowerCase() === val.toLowerCase() || c.shortName?.toLowerCase() === val.toLowerCase());
                    setNewProject(prev => ({
                      ...prev,
                      client: val,
                      clientLogo: matched ? matched.logoUrl : prev.clientLogo,
                      solution: matched?.defaultSolution || prev.solution
                    }));
                  }}
                  placeholder="Selecione ou digite..."
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                  required
                />
                <datalist id="client-suggestions">
                  {clients.map(c => (
                    <option key={c.id} value={c.name}>{c.shortName} ({rot.solucao(c.defaultSolution)})</option>
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status:</label>
                <select
                  value={newProject.status || 'ATIVO'}
                  onChange={e => setNewProject({ ...newProject, status: e.target.value as ProjectStatus })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900 font-bold"
                >
                  <option value="ATIVO">ATIVO</option>
                  <option value="ENCERRADO">ENCERRADO</option>
                  <option value="DEMONSTRATIVO">DEMONSTRATIVO</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Data Encerramento:</label>
                <input
                  type="date"
                  value={newProject.closureDate || ''}
                  onChange={e => setNewProject({ ...newProject, closureDate: e.target.value })}
                  disabled={newProject.status !== 'ENCERRADO'}
                  className={`w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900 ${
                    newProject.status !== 'ENCERRADO' ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''
                  }`}
                />
              </div>
            </div>

            {/* Bloco 1b: Identificação oficial (preenchida pelo Claude a partir da RSE) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project ID (S4 Public Exed):</label>
                <input
                  type="text"
                  value={newProject.projectIdS4 || ''}
                  onChange={e => {
                    const valor = e.target.value.trim();
                    setNewProject({ ...newProject, projectIdS4: valor, projectIdMissing: valor ? false : newProject.projectIdMissing });
                  }}
                  placeholder="Ex.: BRLTKIPIP250304"
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900 font-mono"
                />
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Vem da aba PROJECT DATA da RSE. É por ele que o Claude encontra o projeto nas próximas migrações.
                </p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gerente de portfólio:</label>
                <input
                  type="text"
                  value={newProject.portfolioManager || ''}
                  onChange={e => setNewProject({ ...newProject, portfolioManager: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                />
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Responsável pela frente, conforme Frentes e soluções.
                </p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Frente:</label>
                <select
                  value={newProject.front || ''}
                  onChange={e => setNewProject({ ...newProject, front: (e.target.value || undefined) as FrontType | undefined })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                >
                  <option value="">Pelo gerente de portfólio</option>
                  {rot.catalogo.frentes.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Em branco, a frente segue o responsável cadastrado.
                </p>
              </div>
            </div>

            {/* Bloco 2: Gestão & Financeiro */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Solução:</label>
                <select
                  value={newProject.solution || 'RISE'}
                  onChange={e => setNewProject({ ...newProject, solution: e.target.value as SolutionType })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                >
                  {rot.catalogo.solucoes.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">GP Responsável:</label>
                <input
                  type="text"
                  value={newProject.projectManager || ''}
                  onChange={e => setNewProject({ ...newProject, projectManager: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Orçado (R$):</label>
                <input
                  type="number"
                  value={newProject.budgetPlanned ?? 1000000}
                  onChange={e => setNewProject({ ...newProject, budgetPlanned: Number(e.target.value) })}
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Realizado (R$):</label>
                <input
                  type="number"
                  value={newProject.budgetRealized ?? 950000}
                  onChange={e => setNewProject({ ...newProject, budgetRealized: Number(e.target.value) })}
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Faturado (R$):</label>
                <input
                  type="number"
                  value={newProject.billed ?? 900000}
                  onChange={e => setNewProject({ ...newProject, billed: Number(e.target.value) })}
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  required
                />
              </div>
            </div>

            {/* Bloco 3: Indicadores de Desempenho & Governança */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Margem (%):</label>
                <input
                  type="number"
                  step="0.1"
                  value={newProject.marginPercent ?? 25.0}
                  onChange={e => setNewProject({ ...newProject, marginPercent: Number(e.target.value) })}
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status VMO (Farol):</label>
                <select
                  value={newProject.trafficTag || 'Verde'}
                  onChange={e => setNewProject({ ...newProject, trafficTag: e.target.value as TrafficTag })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900 font-bold"
                >
                  <option value="Verde">Verde (Normal)</option>
                  <option value="Amarelo">Amarelo (Atenção)</option>
                  <option value="Vermelho">Vermelho (Crítico)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status QA:</label>
                <select
                  value={newProject.qaStatus || 'Auditado'}
                  onChange={e => setNewProject({ ...newProject, qaStatus: e.target.value as any })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                >
                  <option value="Auditado">Auditado</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Em Revisão">Em Revisão</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Atraso Cronograma (%):</label>
                <input
                  type="number"
                  step="0.1"
                  value={newProject.scheduleDelayPercent ?? 0}
                  onChange={e => setNewProject({ ...newProject, scheduleDelayPercent: Number(e.target.value) })}
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Docs Assinados (%):</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  disabled={newProject.isLegacyDocs}
                  value={newProject.isLegacyDocs ? '' : (newProject.signedDocumentsPercent ?? 95)}
                  onChange={e => setNewProject({ ...newProject, signedDocumentsPercent: Number(e.target.value) })}
                  placeholder={newProject.isLegacyDocs ? 'Legado / Sem Docs' : '0-100%'}
                  className={`w-full p-1.5 border text-xs font-mono ${
                    newProject.isLegacyDocs ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-900 border-slate-300'
                  }`}
                />
                <label className="inline-flex items-center gap-1 mt-1 text-[10px] text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(newProject.isLegacyDocs)}
                    onChange={e => setNewProject({ ...newProject, isLegacyDocs: e.target.checked })}
                    className="rounded"
                  />
                  Controle interno agendado (Legado)
                </label>
              </div>
            </div>

            {/* Bloco 4: Operações, Cloud ALM, NPS & CRs */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adoção SAP Cloud ALM:</label>
                <select
                  value={newProject.usesCloudAlm ? 'true' : 'false'}
                  onChange={e => setNewProject({ ...newProject, usesCloudAlm: e.target.value === 'true' })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                >
                  <option value="true">Sim (Utiliza Cloud ALM)</option>
                  <option value="false">Não (Não Utiliza)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nota NPS (0 a 10):</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={newProject.npsScore ?? 9.5}
                  onChange={e => setNewProject({ ...newProject, npsScore: Number(e.target.value) })}
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Orçamento Alocado (Planej/Real):</label>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    value={newProject.plannedResources ?? 12}
                    onChange={e => setNewProject({ ...newProject, plannedResources: Number(e.target.value) })}
                    placeholder="Plan"
                    title="Orçamento Planejado"
                    className="p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  />
                  <input
                    type="number"
                    value={newProject.totalResources ?? 12}
                    onChange={e => setNewProject({ ...newProject, totalResources: Number(e.target.value) })}
                    placeholder="Real"
                    title="Orçamento Real Alocado"
                    className="p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Variação de Orçamento (% MoM):</label>
                <input
                  type="number"
                  step="0.1"
                  value={newProject.resourceVariancePercent ?? 0}
                  onChange={e => setNewProject({ ...newProject, resourceVariancePercent: Number(e.target.value) })}
                  placeholder="Ex: 5 ou -3"
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Bloco 5: CRs, Gasto Reembolsável, Pendências e Notas */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200">
              <div>
                <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(newProject.hasOpenCr)}
                    onChange={e => setNewProject({ ...newProject, hasOpenCr: e.target.checked })}
                    className="rounded"
                  />
                  Possui CR em Aberto?
                </label>
                {newProject.hasOpenCr && (
                  <div className="space-y-1 mt-1">
                    <input
                      type="number"
                      value={newProject.crValue ?? 0}
                      onChange={e => setNewProject({ ...newProject, crValue: Number(e.target.value) })}
                      placeholder="Valor da CR (R$)"
                      className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                    />
                    <input
                      type="date"
                      value={newProject.crOpenDate || ''}
                      onChange={e => setNewProject({ ...newProject, crOpenDate: e.target.value })}
                      className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                    />
                    <input
                      type="text"
                      value={newProject.crDescription || ''}
                      onChange={e => setNewProject({ ...newProject, crDescription: e.target.value })}
                      placeholder="Descrição da CR"
                      className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pendências (nº):</label>
                <input
                  type="number"
                  min={0}
                  value={newProject.pendenciesCount ?? 0}
                  onChange={e => setNewProject({ ...newProject, pendenciesCount: Number(e.target.value) })}
                  placeholder="Ex: 3"
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">Não vem da planilha RSE — preencha manualmente.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Total Gasto Reembolsável (R$):</label>
                <input
                  type="number"
                  value={newProject.reimbursableExpenseTotal ?? 0}
                  onChange={e => setNewProject({ ...newProject, reimbursableExpenseTotal: Number(e.target.value) })}
                  placeholder="Ex: 35000"
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pasta SharePoint / Obs:</label>
                <input
                  type="text"
                  value={newProject.sharePointFolder || ''}
                  onChange={e => setNewProject({ ...newProject, sharePointFolder: e.target.value })}
                  placeholder="URL da pasta no SharePoint"
                  className="w-full p-1.5 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              {editingProjectId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer border-none text-xs transition-colors"
                >
                  Cancelar Edição
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2 bg-[#0B2240] hover:bg-exed-accent text-white font-bold cursor-pointer border-none text-xs transition-colors shadow-sm"
              >
                {editingProjectId ? 'Salvar Alterações do Projeto' : 'Salvar Novo Projeto SAP'}
              </button>
            </div>
          </form>

          {/* Projects Table with Edit and Delete actions */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-[10px]">
                  <th className="p-2 border border-slate-300">Código</th>
                  <th className="p-2 border border-slate-300">Logo + Cliente / Projeto</th>
                  <th className="p-2 border border-slate-300">Frente</th>
                  <th className="p-2 border border-slate-300">Solução</th>
                  <th className="p-2 border border-slate-300">GP</th>
                  <th className="p-2 border border-slate-300 text-right">Orçado</th>
                  <th className="p-2 border border-slate-300 text-right">Realizado</th>
                  <th className="p-2 border border-slate-300 text-center">Margem</th>
                  <th className="p-2 border border-slate-300 text-center">VMO</th>
                  <th className="p-2 border border-slate-300 text-center">Status QA</th>
                  <th className="p-2 border border-slate-300 text-center">Status</th>
                  <th className="p-2 border border-slate-300 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const logoUrl =
                    p.clientLogo ||
                    clients.find(c => c.name === p.client || (p.client && c.shortName && p.client.includes(c.shortName)))?.logoUrl;

                  const isBeingEdited = editingProjectId === p.id;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isBeingEdited ? 'bg-amber-50 border-l-4 border-l-exed-accent' : ''
                      }`}
                    >
                      <td className="p-2 border border-slate-200 font-mono font-bold text-slate-900">
                        {p.code}
                        {p.projectIdS4 ? (
                          p.projectIdS4 !== p.code && (
                            <div className="text-[10px] font-normal text-slate-500">S4: {p.projectIdS4}</div>
                          )
                        ) : (
                          <div className="mt-0.5 inline-block px-1 py-0.5 text-[9px] font-sans font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Sem Project ID S4
                          </div>
                        )}
                      </td>
                      <td className="p-2 border border-slate-200">
                        <div className="flex items-center gap-2">
                          <ClientLogo
                            clientName={p.client}
                            logoUrl={logoUrl}
                            size="sm"
                            theme="light"
                          />
                          <div>
                            <div className="font-semibold text-slate-800">{p.name}</div>
                            <div className="text-[11px] text-slate-500">{p.client}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 border border-slate-200">
                        <select
                          value={frenteEfetiva(p, catalogoPortfolio) || ''}
                          onChange={e => {
                            const escolhida = e.target.value as FrontType | '';
                            alterarProjeto(
                              p.id,
                              escolhida
                                ? { front: escolhida, frontManual: true }
                                : {
                                    front: definirFrente(catalogoPortfolio, p.portfolioManager).frente || undefined,
                                    frontManual: false
                                  }
                            );
                          }}
                          aria-label={`Frente de ${p.name}`}
                          className="w-full min-w-[110px] p-1 border border-slate-300 text-[11px] bg-white text-slate-900"
                        >
                          <option value="">Automática (responsável)</option>
                          {rot.catalogo.frentes.map(f => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </select>
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          {p.frontManual
                            ? 'Fixada pelo PMO'
                            : frenteEfetiva(p, catalogoPortfolio)
                            ? 'Pelo responsável'
                            : 'Responsável sem frente'}
                        </span>
                      </td>
                      <td className="p-2 border border-slate-200">
                        <select
                          value={normalizarSolucao(p.solution, catalogoPortfolio) || ''}
                          onChange={e => alterarProjeto(p.id, { solution: e.target.value as SolutionType })}
                          aria-label={`Solução de ${p.name}`}
                          className="w-full min-w-[90px] p-1 border border-slate-300 text-[11px] bg-white text-slate-900 font-semibold"
                        >
                          {!normalizarSolucao(p.solution, catalogoPortfolio) && <option value="">—</option>}
                          {rot.catalogo.solucoes.map(sol => (
                            <option key={sol.key} value={sol.key}>{sol.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 border border-slate-200 text-slate-600 text-[11px]">
                        {p.projectManager || '—'}
                        {p.portfolioManager && (
                          <div className="text-[10px] text-slate-400">Portfólio: {p.portfolioManager}</div>
                        )}
                      </td>
                      <td className="p-2 border border-slate-200 text-right font-mono">
                        {typeof p.budgetPlanned === 'number' ? `R$ ${p.budgetPlanned.toLocaleString('pt-BR')}` : '—'}
                      </td>
                      <td className="p-2 border border-slate-200 text-right font-mono font-bold">
                        {typeof p.budgetRealized === 'number' ? `R$ ${p.budgetRealized.toLocaleString('pt-BR')}` : '—'}
                      </td>
                      <td className="p-2 border border-slate-200 text-center font-mono font-semibold">
                        <span className={p.marginPercent < 20 ? 'text-rose-600' : 'text-emerald-700'}>
                          {typeof p.marginPercent === 'number' ? `${p.marginPercent.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="p-2 border border-slate-200 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-xs ${
                            p.trafficTag === 'Vermelho'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : p.trafficTag === 'Amarelo'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {p.trafficTag}
                        </span>
                      </td>
                      <td className="p-2 border border-slate-200 text-center">
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {p.qaStatus || 'Auditado'}
                        </span>
                      </td>
                      <td className="p-2 border border-slate-200 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-xs ${
                            p.status === 'ENCERRADO'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : p.status === 'DEMONSTRATIVO'
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {p.status || 'ATIVO'}
                        </span>
                      </td>
                      <td className="p-2 border border-slate-200 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditProject(p)}
                            className="text-[#0B2240] hover:text-exed-accent font-bold underline cursor-pointer bg-transparent border-none text-[11px]"
                          >
                            Editar
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteProject(p.id)}
                            className="text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer bg-transparent border-none text-[11px]"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: REFERENCE PERIOD */}
      {/* ========================================================================= */}
      {activeSection === 'period' && (
        <div className="bg-white border border-slate-300 p-4 text-xs space-y-4" id="period-config-panel">
          <div className="font-bold text-sm text-[#0B2240] uppercase tracking-wide border-b border-slate-200 pb-2">
            Configuração da Data de Referência do VMO
          </div>

          <div className="p-3 bg-slate-50 border border-slate-300 max-w-lg space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data Atual / Base:</label>
              <input
                type="text"
                value={referencePeriod.currentDate}
                onChange={e => handleCalculateDateFromCurrent(e.target.value)}
                placeholder="DD/MM/AAAA (ex: 04/09/2026)"
                className="w-full p-2 border border-slate-300 text-xs font-mono bg-white text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Início do Ciclo:</label>
                <input
                  type="text"
                  value={referencePeriod.startDate}
                  onChange={e =>
                    onUpdateReferencePeriod({ ...referencePeriod, startDate: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fim do Ciclo:</label>
                <input
                  type="text"
                  value={referencePeriod.endDate}
                  onChange={e =>
                    onUpdateReferencePeriod({ ...referencePeriod, endDate: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 text-xs font-mono bg-white text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 7: MIGRAÇÃO E API */}
      {/* ========================================================================= */}
      {activeSection === 'migration' && (
        <div className="bg-white border border-slate-300 p-4 text-xs space-y-4" id="migration-config-panel">
          <div className="font-bold text-sm text-[#0B2240] uppercase tracking-wide border-b border-slate-200 pb-2">
            MIGRAÇÃO E API
          </div>

          <div className="p-4 bg-slate-50 border border-slate-300 space-y-3">
            <div>
              <label
                htmlFor="campo-local-dos-dados"
                className="block font-bold text-xs uppercase tracking-wider text-[#0B2240] mb-1"
              >
                Local dos dados
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="campo-local-dos-dados"
                  type="url"
                  value={migrationLink}
                  onChange={e => handleUpdateMigrationLink(e.target.value)}
                  placeholder=""
                  className="flex-1 p-2 border border-slate-300 text-xs font-mono bg-white text-slate-900 focus:outline-none focus:border-exed-accent focus:ring-1 focus:ring-exed-accent"
                />
                <button
                  type="button"
                  onClick={handleSaveMigrationLink}
                  className="px-4 py-2 bg-[#0B2240] hover:bg-exed-accent text-white font-bold cursor-pointer border-none text-xs transition-colors whitespace-nowrap"
                >
                  Salvar
                </button>
                {migrationLink && (
                  <a
                    href={migrationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-[#0B2240] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-300 no-underline"
                    title="Abrir no SharePoint"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Acessar</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Integração Corporativa Claude via API */}
          <div className="p-4 bg-white border border-slate-300 space-y-4" id="claude-api-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={handleTestClaudeApi}
                disabled={isTestingApi}
                className="px-3 py-1.5 bg-[#0B2240] hover:bg-slate-800 text-white font-bold text-xs cursor-pointer border-none flex items-center gap-1.5 transition-colors"
              >
                {isTestingApi ? 'Testando Conexão...' : 'Testar Conexão com API do Claude'}
              </button>
            </div>

            {/* Test Feedback Message */}
            {apiTestStatus && (
              <div
                className={`p-3 text-xs border ${
                  apiTestStatus.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                <div className="font-bold">{apiTestStatus.message}</div>
                {apiTestStatus.details && (
                  <div className="mt-1 font-mono text-[10px] text-slate-600">
                    Projetos acessíveis: {apiTestStatus.details.totalProjetos} | Instruções ativas: {apiTestStatus.details.instrucoes ? 'Sim' : 'Vazio'} | Local de dados configurado: {apiTestStatus.details.localDosDados ? 'Sim' : 'Não'}
                  </div>
                )}
              </div>
            )}

            {/* Chave de API e Endpoints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  <span>Chave de Autenticação Corporativa (API Key):</span>
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={claudeApiKey}
                    onChange={e => setClaudeApiKey(e.target.value)}
                    className="flex-1 p-2 border border-slate-300 font-mono text-xs text-slate-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    className="px-3 py-1.5 bg-[#0B2240] hover:bg-slate-800 text-white font-bold text-xs cursor-pointer border-none"
                    title="Salvar chave"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyText(claudeApiKey, 'key')}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer border border-slate-300 flex items-center gap-1"
                    title="Copiar API Key"
                  >
                    {copiedApiKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Cabeçalho aceito: <code className="bg-slate-100 px-1 py-0.5">x-api-key: &lt;sua chave&gt;</code> ou <code className="bg-slate-100 px-1 py-0.5">Authorization: Bearer &lt;sua chave&gt;</code>
                  {!hasStoredApiKey() && (
                    <span className="block mt-1.5 p-2 bg-amber-50 border border-amber-300 text-amber-900 font-semibold">
                      Nenhuma chave configurada neste navegador. Cole acima a mesma chave definida na
                      variável de ambiente EXED_API_KEY da Vercel. Sem ela, salvar dados pela tela
                      falha com 401 — leitura do dashboard continua funcionando.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Endpoint de Leitura e Escrita Total:</span>
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/api/vmo/state` : '/api/vmo/state'}
                    className="flex-1 p-2 border border-slate-300 font-mono text-xs text-slate-700 bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        typeof window !== 'undefined' ? `${window.location.origin}/api/vmo/state` : '/api/vmo/state',
                        'endpoint'
                      )
                    }
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer border border-slate-300 flex items-center gap-1"
                    title="Copiar Endpoint"
                  >
                    {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                  <span>GET para ler tudo | POST / PUT para salvar alterações</span>
                  <span>•</span>
                  <a
                    href="/api/vmo/openapi.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0B2240] underline font-bold"
                  >
                    Ver Schema OpenAPI 3.0
                  </a>
                </div>
              </div>
            </div>

            {/* Prompt Modelo Pronto para Colar no Claude (Editável com fonte, cores e fundo padrão) */}
            <div className="border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                  Prompt Inicial Recomendado para o Claude Corporativo:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveClaudePrompt}
                    className="px-2.5 py-1 bg-[#0B2240] hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer border-none flex items-center gap-1"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyText(claudePrompt, 'prompt')}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 font-bold text-[11px] cursor-pointer border border-slate-300 flex items-center gap-1"
                  >
                    {copiedPrompt ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPrompt ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
              <textarea
                value={claudePrompt}
                onChange={e => setClaudePrompt(e.target.value)}
                rows={6}
                className="w-full p-2 border border-slate-300 font-mono text-xs text-slate-900 bg-white focus:outline-none focus:border-exed-accent focus:ring-1 focus:ring-exed-accent leading-relaxed resize-y"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 8: DADOS E BACKUP */}
      {/* ========================================================================= */}
      {activeSection === 'demonstrativo' && (
        <div className="bg-white border border-slate-300 p-4 space-y-4 text-xs" id="dados-backup-panel">
          <div className="font-bold text-sm text-[#0B2240] uppercase tracking-wide border-b border-slate-200 pb-2">
            Dados e backup
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border border-slate-200 bg-slate-50 p-4 space-y-2 flex flex-col">
              <div className="font-bold text-slate-900 text-sm">Baixar backup completo</div>
              <p className="text-[11px] text-slate-600 flex-1">
                Gera um arquivo JSON com tudo o que está no banco: projetos, clientes, histórico mensal, projetos sem atualização, frentes e soluções, instruções, layouts, configurações, registro de IDs e log de arquivos. Usuários e senhas não entram.
              </p>
              <button
                type="button"
                onClick={handleDownloadJsonWithReactivation}
                className="px-4 py-2 bg-exed-accent hover:bg-exed-accent-strong text-white font-bold cursor-pointer border-none text-xs transition-colors self-start"
              >
                Baixar backup (JSON)
              </button>
            </div>

            <div className="border border-slate-200 bg-slate-50 p-4 space-y-2 flex flex-col">
              <div className="font-bold text-slate-900 text-sm">Carregar backup</div>
              <p className="text-[11px] text-slate-600 flex-1">
                Substitui todos os dados do banco e desta tela pelo conteúdo de um backup completo. Antes de confirmar, você vê o que o arquivo traz.
              </p>
              <input
                type="file"
                ref={backupInputRef}
                onChange={handleSelecionarBackup}
                accept=".json,application/json"
                className="hidden"
                id="input-backup-completo"
              />
              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="px-4 py-2 bg-[#0B2240] hover:bg-exed-accent text-white font-bold cursor-pointer border-none text-xs transition-colors self-start"
              >
                Selecionar backup (JSON)
              </button>
              {backupPendente && (
                <div className="border border-sky-300 bg-sky-50 p-2 space-y-2">
                  <div className="font-semibold text-sky-900">Backup gerado em {formatarDataHora(backupPendente.gerado_em)}</div>
                  <ul className="text-[11px] text-sky-900 list-disc pl-4 space-y-0.5">
                    <li>{resumoBackupPendente.projetos ?? '?'} projetos e {resumoBackupPendente.clientes ?? '?'} clientes</li>
                    <li>
                      {resumoBackupPendente.meses_historico ?? '?'} meses de histórico e {resumoBackupPendente.projetos_sem_atualizacao ?? '?'} projetos sem atualização
                    </li>
                    <li>
                      {resumoBackupPendente.registro_ids ?? '?'} projetos no registro de IDs e {resumoBackupPendente.arquivos_migrados ?? '?'} arquivos no log
                    </li>
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={restaurando}
                      onClick={handleConfirmarRestauracao}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold border-none text-xs cursor-pointer"
                    >
                      {restaurando ? 'Restaurando…' : 'Substituir dados por este backup'}
                    </button>
                    <button
                      type="button"
                      disabled={restaurando}
                      onClick={() => setBackupPendente(null)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold border border-slate-300 text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-rose-300 bg-rose-50 p-4 space-y-2 flex flex-col">
              <div className="font-bold text-rose-900 text-sm">Apagar todos os dados</div>
              <p className="text-[11px] text-rose-900 flex-1">
                Remove projetos, clientes, histórico mensal, projetos sem atualização, registro de IDs e log de arquivos, no banco e nesta tela. Mantém instruções, frentes e soluções, layout e configurações. Não dá para desfazer: baixe um backup antes.
              </p>
              <label htmlFor="confirmacao-apagar" className="text-[11px] font-semibold text-rose-900">
                Digite APAGAR para confirmar
              </label>
              <input
                id="confirmacao-apagar"
                type="text"
                value={textoConfirmacaoApagar}
                onChange={e => setTextoConfirmacaoApagar(e.target.value)}
                autoComplete="off"
                className="w-full max-w-[200px] p-1.5 border border-rose-300 text-xs bg-white text-slate-900"
              />
              <button
                type="button"
                onClick={handleApagarTudo}
                disabled={apagando || textoConfirmacaoApagar.trim().toUpperCase() !== 'APAGAR'}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold cursor-pointer border-none text-xs transition-colors self-start"
              >
                {apagando ? 'Apagando…' : 'Apagar todos os dados'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 9: USUÁRIOS */}
      {/* ========================================================================= */}
      {activeSection === 'usuarios' && <UsersConfigSection session={session} />}

      {activeSection === 'layout' && (
        <LayoutConfigSection
          pageLayout={pageLayout}
          containerLayout={containerLayout}
          onUpdatePageLayout={onUpdatePageLayout}
          onUpdateContainerLayout={onUpdateContainerLayout}
        />
      )}

      {activeSection === 'historico' && (
        <MonthlyHistoryConfigSection
          monthlyHistory={monthlyHistory}
          onUpdateMonthlyHistory={onUpdateMonthlyHistory}
        />
      )}
    </div>
  );
};
