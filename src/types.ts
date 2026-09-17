export type UserRole = 'pmo' | 'demonstrativo';

export type AppTheme = 'neon' | 'light' | 'dark-solid';

// Solução: tipo de oferta SAP do projeto (RSE → PROJECT DATA → "Project Portfolio").
// Frente: unidade de gestão chefiada pelo gerente de portfólio responsável. A
// divisão é por PROJETO: projetos da mesma solução podem estar em frentes diferentes. As chaves são fixas (6 soluções e 5 frentes); os
// nomes exibidos ficam em CatalogoPortfolio e o PMO pode alterá-los.
// Regras e conversões: src/utils/portfolio.ts.
export type SolutionType = 'RISE' | 'GROW' | 'SCE' | 'SCP' | 'FSW' | 'DSC';
export type FrontType = 'RISE' | 'GROW' | 'IBP' | 'SUPPLY_CHAIN' | 'FABRICA';

export interface SolucaoConfig {
  key: SolutionType;
  label: string;
}

export interface FrenteConfig {
  key: FrontType;
  label: string;
  responsaveis: string[]; // gerentes de portfólio responsáveis, como aparecem na RSE
}

export interface CatalogoPortfolio {
  solucoes: SolucaoConfig[]; // sempre 6, na ordem de SOLUCOES_KEYS
  frentes: FrenteConfig[]; // sempre 5, na ordem de FRENTES_KEYS
}

export type TrafficTag = 'Verde' | 'Amarelo' | 'Vermelho';

export type ProjectStatus = 'ATIVO' | 'ENCERRADO' | 'DEMONSTRATIVO';

/**
 * Recorte de um projeto dentro de um mês fechado. Existe para que o
 * "Comparativo Mês Ant." por projeto (Informações Gerais e Detalhamento
 * Financeiro) seja CALCULADO em vez de digitado à mão. É opcional: quando não
 * houver snapshot do mês anterior para um projeto, a interface mostra "—" em
 * vez de inventar uma variação.
 *
 * `projectId` deve ser o mesmo identificador estável usado em
 * SapProjectFinancial.id (derivado do `Project ID (S4 Public Exed)`), NUNCA o
 * nome do arquivo da RSE — os nomes mudam de uma semana para a outra.
 */
export interface MonthlyProjectSnapshot {
  projectId: string;
  client?: string;
  solution?: string;
  front?: string;
  budgetRealized?: number; // uso de orçamento real no mês (R$)
  billed?: number; // faturado acumulado do projeto até o fechamento do mês (R$)
  marginPercent?: number; // margem do projeto no mês (%)
  reimbursableExpenseTotal?: number; // gasto reembolsável do projeto no mês (R$)
}

export interface MonthlyKpiSnapshot {
  parcial?: boolean; // mês em andamento: dados até a última RSE, regravar no fechamento
  monthKey: string; // 'YYYY-MM', ex: '2026-03' — usado como identificador único
  year: number;
  month: number; // 1 a 12
  revenueBilled: number; // faturamento total do mês (R$), NÃO acumulado
  marginAvg: number; // margem média do mês (%)

  // ---------------------------------------------------------------------------
  // Campos OPCIONAIS acrescentados para os comparativos mês a mês.
  // São opcionais de propósito: registros gravados antes desta versão continuam
  // válidos. Onde o dado não existir, a interface não desenha o comparativo —
  // nunca preenche com estimativa.
  // ---------------------------------------------------------------------------

  // One Page — cartões de "Principais informações do mês"
  totalSpend?: number; // gasto/uso de orçamento total do mês (R$)
  clientsServed?: number; // clientes distintos atendidos no mês
  goLivesCompleted?: number; // go-lives concluídos no mês
  activeProjects?: number; // projetos ativos no mês
  avgScheduleDelay?: number; // atraso médio de cronograma no mês (%)
  npsAvg?: number; // NPS médio do mês (0 a 10)

  // Pontos de Atenção
  signedDocsAvg?: number; // % médio de documentação assinada junto ao PMO
  detractorCount?: number; // projetos abaixo da meta de receita ou de margem

  // Informações Gerais
  almAdoptionPercent?: number; // % de projetos usando SAP Cloud ALM
  openCrCount?: number; // quantidade de CRs em aberto no mês
  openCrValue?: number; // valor somado das CRs em aberto (R$)

  // Detalhamento Financeiro
  plannedBudgetTotal?: number; // uso de orçamento total planejado (R$)
  reimbursableTotal?: number; // total de gasto reembolsável do mês (R$)

  // Detalhe por projeto (habilita o comparativo por linha das tabelas)
  projectSnapshots?: MonthlyProjectSnapshot[];
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
  solution: SolutionType; // chave da solução (RSE → Project Portfolio)
  front?: FrontType; // chave da frente (definida pelo gerente de portfólio responsável)
  frontManual?: boolean; // true quando o PMO fixou a frente; migrações mantêm
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
  // ---------------------------------------------------------------------------
  // Identificação e financeiro vindos da RSE (manual de migração v3)
  // ---------------------------------------------------------------------------
  projectIdS4?: string; // "Project ID (S4 Public Exed)" da aba PROJECT DATA — preenchido pelo Claude
  projectIdMissing?: boolean; // true quando a RSE não trouxe o ID (id usa chave provisória)
  portfolioManager?: string; // Gerente de portfólio — responsável pela frente (ver CatalogoPortfolio)
  plannedStartDate?: string; // Início planejado (AAAA-MM-DD)
  contractRevenue?: number; // Receita contratada CTR + CR (BILLING → Total)
  contractValue?: number; // Receita do contrato original (BILLING → Contract)
  taxRatePercent?: number; // Taxa de impostos do P&L Analytics (%)
  marginPlanPercent?: number; // Margem planejada CTR + CR (%)
  expensesNotReimbursable?: number; // Despesas não reembolsáveis (R$), somadas ao custo
}

/**
 * Projeto cuja RSE mais recente tem Status Date fora do mês migrado: o GP não
 * atualizou. Não entra no histórico nem na lista de projetos daquele mês e é
 * listado em Pontos de Atenção. Mantido pelo Claude na migração.
 */
export interface ProjetoSemAtualizacao {
  projectId: string; // Project ID (S4) ou chave provisória
  projectIdS4?: string;
  name: string;
  client?: string;
  solution?: string;
  front?: string;
  projectManager?: string;
  portfolioManager?: string;
  monthKey: string; // AAAA-MM do mês em que a atualização faltou
  lastStatusDate?: string; // último Status Date encontrado (AAAA-MM-DD)
  sourceFile?: string; // arquivo onde a atualização era esperada
  detectedAt?: string; // quando foi detectado (ISO)
  notes?: string;
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
  projetosSemAtualizacao?: ProjetoSemAtualizacao[];
  catalogoPortfolio?: CatalogoPortfolio;
  // Controle de concorrência da sincronização do webapp: a gravação é recusada
  // (409) se o servidor tiver sido alterado depois desta data.
  baseLastSaved?: string | null;
  // Só com true o servidor aceita listas vazias (botão "Zerar dados").
  confirmarLimpeza?: boolean;
  lastSaved: string;
  supabaseSyncedAt?: string;
}

export interface ContainerParamSettings {
  // One Page Settings
  // As metas são OPCIONAIS: quando vierem vazias/zeradas, a linha de meta
  // simplesmente não é desenhada no gráfico (em vez de cair num default de
  // 120 milhões que ninguém configurou).
  annualRevenueTarget?: number; // Meta de receita total (ex: 120000000)
  contractMarginTarget?: number; // Meta de margem contratual (ex: 24.0)
  topClientsLimit: number; // Quantos clientes mostrar no ranking (ex: 5)

  // Pontos de Atenção Settings
  gaugeMinScale: number; // Escala mínima do gráfico de arco (ex: 94.0)
  governanceComplianceThreshold?: number; // Limite de conformidade de documentação (ex: 80.0)
  delayRedLimit: number; // Atraso considerado crítico em vermelho (ex: 2.0%)
  detractorRevenueCutoff: number; // Ponto de corte para detratores de receita (ex: 0 = abaixo do orçado)
  docsGreenLimit: number; // Limite verde para documentação assinada (ex: 80%)
  docsYellowLimit: number; // Limite amarelo para documentação assinada (ex: 70%)
  legacyNoticeText: string; // Texto para projetos legados sem docs migradas

  // Informações Gerais Settings
  almAdoptionTarget: number; // Meta de adoção SAP Cloud ALM (ex: 80%)
  npsPromoterCutoff: number; // Ponto de corte para cliente promotor (ex: 75 ou nota 9)
  npsTargetScore?: number; // Nota de NPS considerada promotora, escala 0-10 (ex: 8.5)
  crHighValueAlert: number; // Valor de CR que aciona alerta de risco no PMO (ex: 100000)
}

