export type UserRole = 'pmo' | 'demonstrativo';

export type AppTheme = 'neon' | 'light' | 'dark-solid';

export type SolutionType = 'Fábrica' | 'RISE' | 'GROW' | 'SCP (IBP)' | 'SCE';

export type TrafficTag = 'Verde' | 'Amarelo' | 'Vermelho';

export type ProjectStatus = 'ATIVO' | 'ENCERRADO' | 'DEMONSTRATIVO';

export interface MonthlyKpiSnapshot {
  monthKey: string; // 'YYYY-MM', ex: '2026-03' — usado como identificador único
  year: number;
  month: number; // 1 a 12
  revenueBilled: number; // faturamento total do mês (R$), NÃO acumulado
  marginAvg: number; // margem média do mês (%)
}

export interface UserSession {
  username: string;
  role: UserRole;
  token: string;
  loginTime: string;
  expiresInMinutes: number;
  userId?: string;
  name?: string;
}

export interface AuthUserRecord {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientInfo {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string; // Caminho para PNG (/assets/logos/...) ou Data URL (base64)
  primaryColor?: string;
  defaultSolution?: SolutionType;
  notes?: string;
  status?: ProjectStatus; // 'ATIVO' | 'ENCERRADO' | 'DEMONSTRATIVO'
  closureDate?: string; // Data de encerramento (opcional / vazia)
}

export interface SapProjectFinancial {
  id: string;
  code: string;
  name: string;
  client: string;
  clientLogo?: string; // PNG pequeno ou Data URL em base64
  solution: SolutionType;
  projectManager?: string; // GP responsável
  budgetPlanned: number; // Orçado
  budgetRealized: number; // Realizado
  billed: number; // Faturado
  costVariancePercent: number; // Desvio %
  marginPercent: number; // Margem %
  trafficTag: TrafficTag;
  status?: ProjectStatus; // 'ATIVO' | 'ENCERRADO' | 'DEMONSTRATIVO'
  closureDate?: string; // Data de encerramento (opcional / vazia)
  scheduleDelayPercent?: number; // % de atraso no cronograma (ex: 0.8%, 2.3%)
  signedDocumentsPercent?: number | null; // % de documentos assinados junto ao PMO (ex: 85%)
  isLegacyDocs?: boolean; // Se verdadeiro, exibe "Dados antigos não incluídos, controle interno agendado"
  qaStatus?: 'Auditado' | 'Pendente' | 'Em Revisão';
  pendenciesCount?: number;
  sharePointFolder: string;
  referenceDate: string;
  notes?: string;

  // Informações Gerais - Contêiner 1: Orçamento & Tabela Geral (anteriormente recursos)
  plannedEndDate?: string; // Data de encerramento planejada
  plannedResources?: number; // Uso de orçamento total planejado (R$)
  totalResources?: number; // Uso de orçamento total real (R$)
  remainingResources?: number; // Orçamento restante / saldo (R$)
  reimbursableExpenseTotal?: number; // Total do gasto reembolsável (R$)
  resourceVariancePercent?: number; // Comparativo com mês anterior (% em verde ou vermelho)

  // Informações Gerais - Contêiner 2: CRs em Aberto
  hasOpenCr?: boolean;
  crValue?: number; // Valor da Solicitação de Mudança / CR (R$)
  crOpenDate?: string; // Data de abertura da CR
  crDescription?: string; // Descrição da solicitação de mudança (CR)

  // Informações Gerais - Contêiner 3: Uso de SAP Cloud ALM
  usesCloudAlm?: boolean; // Se utiliza SAP Cloud ALM

  // Informações Gerais - Contêiner 4: Avaliações NPS
  npsDate?: string; // Data da realização do NPS
  npsScore?: number; // Nota do NPS (0 a 10)
}

export type WidgetType =
  | 'kpi-summary'
  | 'chart-adherence-trend' // 1. Histórico de % Aderência por Mês
  | 'chart-qa-volume-monthly' // 2. Quantidade de QAs / Apurações por Mês
  | 'chart-gp-pendencies' // 3. Pendências / Desvios após QA por GP
  | 'chart-project-pendencies' // 4. Pendências / Desvios após QA por Projeto
  | 'chart-solution-compliance' // 5. Desempenho e Margem por Solução SAP
  | 'chart-control-status' // 6. Projetos por Status do Controle (Tráfego VMO)
  | 'table-projects'; // Tabela Executiva Detalhada

export interface DashboardWidgetConfig {
  id: string;
  title: string;
  type: WidgetType | string;
  order: number;
  visible: boolean;
  collapsed: boolean;
  filterSolutions?: SolutionType[];
  filterTraffic?: TrafficTag[];
}

export type DashboardPageKey = 'one_page' | 'pontos_atencao' | 'informacoes_gerais' | 'detalhamento_financeiro';

export interface PageLayoutConfig {
  key: DashboardPageKey;
  label: string;
  order: number;
  // Quando true, apenas usuários com perfil PMO conseguem ver esta página
  // (inclusive na navegação do dashboard). Demais usuários não a veem.
  hidden: boolean;
}

export interface ContainerLayoutConfig {
  id: string;
  pageKey: DashboardPageKey;
  label: string;
  order: number;
  // Quando true, apenas usuários com perfil PMO conseguem ver este contêiner
  // (inclusive no dashboard). Demais usuários não o veem.
  hidden: boolean;
}

export interface SharePointFolderLink {
  id: string;
  label: string;
  url: string;
  isPrimary: boolean;
  notes: string;
}

export interface VmoReferencePeriod {
  startDate: string; // Dia 02 do mês anterior
  endDate: string; // Dia 01 do mês atual
  currentDate: string;
  periodLabel?: string;
}

export interface PromptRecordItem {
  id: string;
  timestamp: string;
  title: string;
  content: string;
}

// 4 Supabase Entities:
// "O banco deve armazenar os usuários, a configuração dos gráficos, os links e a data. Apenas esses pontos."
export interface SupabaseSyncState {
  lastPing: string | null;
  status: 'active' | 'syncing' | 'idle' | 'error';
  tablesSynced: string[];
  daysRemainingBeforePause: number;
  url: string;
  anonKey: string;
}

export interface AppStateData {
  projects: SapProjectFinancial[];
  widgets: DashboardWidgetConfig[];
  sharePointLinks: SharePointFolderLink[];
  referencePeriod: VmoReferencePeriod;
  clients?: ClientInfo[];
  containerSettings?: ContainerParamSettings;
  theme?: AppTheme;
  instrucoesPreenchimento?: string;
  localDosDados?: string;
  local_dos_dados?: string;
  pageLayout?: PageLayoutConfig[];
  containerLayout?: ContainerLayoutConfig[];
  monthlyHistory?: MonthlyKpiSnapshot[];
  lastSaved: string;
  supabaseSyncedAt?: string;
}

export interface ContainerParamSettings {
  // One Page Settings
  annualRevenueTarget: number; // Meta de receita total (ex: 120000000)
  contractMarginTarget: number; // Meta de margem contratual (ex: 24.0)
  topClientsLimit: number; // Quantos clientes mostrar no ranking (ex: 5)

  // Pontos de Atenção Settings
  gaugeMinScale: number; // Escala mínima do gráfico de arco (ex: 94.0)
  delayRedLimit: number; // Atraso considerado crítico em vermelho (ex: 2.0%)
  detractorRevenueCutoff: number; // Ponto de corte para detratores de receita (ex: 0 = abaixo do orçado)
  docsGreenLimit: number; // Limite verde para documentação assinada (ex: 80%)
  docsYellowLimit: number; // Limite amarelo para documentação assinada (ex: 70%)
  legacyNoticeText: string; // Texto para projetos legados sem docs migradas

  // Informações Gerais Settings
  almAdoptionTarget: number; // Meta de adoção SAP Cloud ALM (ex: 80%)
  npsPromoterCutoff: number; // Ponto de corte para cliente promotor (ex: 75 ou nota 9)
  crHighValueAlert: number; // Valor de CR que aciona alerta de risco no PMO (ex: 100000)
}

