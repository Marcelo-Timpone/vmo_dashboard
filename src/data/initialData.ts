import {
  SapProjectFinancial,
  DashboardWidgetConfig,
  SharePointFolderLink,
  PromptRecordItem,
  ClientInfo,
  PageLayoutConfig,
  ContainerLayoutConfig,
  MonthlyKpiSnapshot
} from '../types';
import { SupabaseUsuarioRow } from '../services/supabaseService';

export const INITIAL_USER_PROMPT = `User Story macro
Quero fazer um mockup que apenas tenha o front-end funcionando, mas que todos os processos desse front end estejam funcionando perfeitamente. Será um webapp que tem o objetivo de mostrar informações, quase um SharePoint, a grande diferença e propósito, é que será um webapp para demonstração de relatórios executivos levantados pelo VMO Corporativo. 

BPD - Estrutura técnica
A sustentação do webapp deve ser em Vercel e utilizando Next.js com Tailwind CSS ou similar para garantir um design responsivo e moderno.

O banco de dados será configurado no próprio Vercel, com login no banco de Vercel global, sem uso de banco de dados externo. 

Login dividido em dois roles de perfis, PMO e demonstrativo. PMO adiciona e configura as informações (vendo  o podendo acessar abas extras) e demonstrativo apenas lê. 

A integração deve poder puxar API externos e ler/editar/gerar documentos do pacote office básico.

A segurança deve ser de ponta. No momento, apenas adicione uma tela de login básica com dois botões para entrar com ou perfil demonstrativo ou perfil PMO; deve existir um botão de ver/esconder a senha; mas já adiante a configuração de segurança.

O designe deve ser limpo, sem uso de emojis ou ícones, sem adição de subtítulos e com navegação focada em menus de texto simples.

Na mesma tela de login, adicione um botão temporário que salva esse prompt inicial e os próximos que eu  enviar, para registro e facilidade quando o app for para desenvolvimento.


BPD - Funcional
Deve existir um cabeçaçalho permanente na tela com o logo Exed e nome do webapp. A linha com as abas deve estar abaixo.

As margens devem ser estreitas e ocupar toda a tela.

No rodapé, adicionar um logo Exed e "VMO Corporativo".

ABA "DASHBOARD": Mostra o conjunto de dados, tabelas e gráficos; exporta em pdf; exporta em PPT; Na parte superior, mostra a data de referência e possui filtros simples por tag do tráfico. Todo gráfico deve poder ser recolhido/escondido pelo usuário; edições dessa aba devem apenas ser salvas localmente para o usuário que editou. - Todas as informações tem foco financeiro. // A empresa é a Exed Consulting e trabalha com consultoria de projetos SAP. // Os projetos são divididos entre as soluções Fábrica, RISE, GROW, SCP (IBP) e SCE. (também devem ser tags dos gráficos)

ABA "CONFIGURAÇÃO": Apenas acessível por usuários com role de PMO; Essa tela permite editar a ordem dos gráficos/tabelas/dados do dash, o conteúdo deles, os filtros dentro dos próprios gráficos, o que aparece ou não e a data de referência; Essa aba também permite subir informações para alimentar os gráficos via Jason, Excel ou CSV; permite salvar o estado do dash e todas as configurações em Jason.

Também é possível adicionar a data atual e o link (ou até 4 links) principal, esses links são para alguma dessas pastas do Sharepoint (https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL), nelas que estão as informações financeiras nas planilhas de cada projeto, divididas por datas; o foco do app será analisar as informações no presente mês; ele vai precisar identificar a data e quais estão relacionados e onde estão as informações. O objetivo inicial é as informações do dia 2 do mês anterior até o dia 1 do mês atual.


BPD - Designe
Logos em anexo para base, que podem ser cortadas e sofrer pequenas edições para caber no app.

As cores devem respeitam a identidade visual Exed, sendo branco, azul escuro e laranja; podendo ter subtons se necessário.

As fontes permitidas são Arial e nanito.`;

export const INITIAL_PROMPT_RECORDS: PromptRecordItem[] = [
  {
    id: 'prompt-1',
    timestamp: '04/09/2026 09:30',
    title: 'Prompt 1 - User Story Macro, BPD Técnico, Funcional e Design',
    content: INITIAL_USER_PROMPT
  },
  {
    id: 'prompt-2',
    timestamp: '04/09/2026 10:15',
    title: 'Prompt 2 - Favicon, Sequência de Gráficos e Estrutura Supabase',
    content: `Ah, adicione como favicon para aparecer na aba, um logo editado para ficar ideal.

A sequência de gráficos deve seguir uma estrutura como essa do exemplo (não as informações, a estrutura).

Altere o Exed consulting no cebeçalho para um logo enviado
--
Banco de dados

Já deixe pré-configurado a estrutura para o banco no Supabase. O banco deve armazenar os usuários, a configuração dos gráficos, os links e a data. Apenas esses pontos.

O processo de baixar e subir o Jason nas configurações, já deve servir como o processo de reativação do supabase, o que impede as limitações do plano gratuito. Por isso, o jason baixado deve conter todas essas informações.`
  },
  {
    id: 'prompt-3',
    timestamp: '04/09/2026 11:05',
    title: 'Prompt 3 - Tela de Login Isolada, Logotipo Oficial Exed e Restrição RBAC Demonstrativo',
    content: `O login tem que ser uma tela de login mesmo com a opção de ver a senha ou não. A tela de login tem que ter apenas usuário e senha para entrar. E opções de entrar como demonstrativo ou pmo, mas não o card que tem hoje. O card atual que está no rodapé deve ser uma tela de login de fato onde não vejo nada do app antes de logar.

O logo da exed deve ser usado no topo do web app e no login. No topo o logo fica branco com fundo escuro. No rodapé o logo fica branco. No card de login ele fica branco no topo do card, no fundo escuro. A logo da Exed é a original enviada nos arquivos, sem recortes e sem texto adicional escrito "exed consulting", pois isso já faz parte da logo.

Não precisa de texto explicando qual perfil está ativo como "Mockup Vercel / Next.js VMO: Perfil Ativo: demonstrativo" na aba de demonstrativo.

Demonstrativo não deve ter acesso a aba de configuração nem de documentos. Quando demonstrativo acessar qualquer aba que não seja a de dashboard, deve aparecer uma tela em branco.

No cabeçalho deve estar escrito apenas VMO Corporativo - Relatórios Consolidados [Mês de referência]. O mês de referência deve ser dinâmico e pegar o mês de referência de acordo com a data configurada no VMO.`
  },
  {
    id: 'prompt-4',
    timestamp: '04/09/2026 12:55',
    title: 'Prompt 4 - Bloqueio de Documentos para Demonstrativo e Título de Referência',
    content: `Demonstrativo ainda tem acesso a aba de documentos e não deveria.

tire "Período Contábil do VMO (Dia 02 do mês anterior até o dia 01 do mês atual) | Empresa: Exed Consulting" e mude "Data de Referência Contábil VMO:" para "Data de Referência:"`
  },
  {
    id: 'prompt-5',
    timestamp: '04/09/2026 13:02',
    title: 'Prompt 5 - Remoção do Badge "PERFIL PMO" do Cabeçalho',
    content: `Retirar essa informação [Referência à imagem enviada contendo a tag visual laranja 'PERFIL PMO' exibida na barra de topo].`
  },
  {
    id: 'prompt-6',
    timestamp: '04/09/2026 13:47',
    title: 'Prompt 6 - Histórico Completo de Prompts e Download em Lote',
    content: `Adicione o histórico de prompts completo e uma opção para baixar todos ao mesmo tempo.`
  }
];

export const INITIAL_SUPABASE_USERS: SupabaseUsuarioRow[] = [
  {
    id: 'usr-pmo',
    username: 'PMO@exedconsulting.com',
    role: 'pmo',
    name: 'Gestor VMO / PMO Corporativo (Exed)',
    updated_at: new Date().toISOString()
  },
  {
    id: 'usr-demo',
    username: 'demonstrativo@exedconsulting.com',
    role: 'demonstrativo',
    name: 'Visualizador Executivo (Demonstrativo)',
    updated_at: new Date().toISOString()
  },
  {
    id: 'usr-fernando',
    username: 'fernando.costa@exedconsulting.com',
    role: 'pmo',
    name: 'Fernando Costa (PMO Leader)',
    updated_at: new Date().toISOString()
  },
  {
    id: 'usr-aline',
    username: 'aline.ribeiro@exedconsulting.com',
    role: 'pmo',
    name: 'Aline Ribeiro (PMO Analytics)',
    updated_at: new Date().toISOString()
  },
  {
    id: 'usr-yara',
    username: 'yara.oliveira@exedconsulting.com',
    role: 'pmo',
    name: 'Yara Oliveira (PMO Governança)',
    updated_at: new Date().toISOString()
  }
];

export const INITIAL_SHAREPOINT_LINKS: SharePointFolderLink[] = [
  {
    id: 'sp-1',
    label: 'Histórico de versões do webapp em JASON.',
    url: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgAL_GSIJkN1SLKiy0lkPJ8VAYZIctQ0c5Okvath-9ajSd0?e=d0cUCt',
    isPrimary: true,
    notes: 'Governança e backup dos registros'
  },
  {
    id: 'sp-2',
    label: 'Dados financeiros 2026.',
    url: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=SqjwUQ',
    isPrimary: false,
    notes: 'Base de dados históricos'
  },
  {
    id: 'sp-3',
    label: 'Dados financeiros do mês de referência.',
    url: '',
    isPrimary: false,
    notes: 'Base de dados atual'
  }
];

// Clientes oficiais com logotipos em PNG pequeno
const RAW_CLIENTS: ClientInfo[] = [
  {
    id: 'cli-gerdau',
    name: 'Grupo Industrial Gerdau & Cia',
    shortName: 'Gerdau',
    logoUrl: '/assets/logos/gerdau.png',
    primaryColor: '#003087',
    defaultSolution: 'RISE',
    notes: 'Siderurgia e Manufatura de Aço'
  },
  {
    id: 'cli-votorantim',
    name: 'Votorantim Logística e Distribuição',
    shortName: 'Votorantim',
    logoUrl: '/assets/logos/votorantim.png',
    primaryColor: '#12284C',
    defaultSolution: 'GROW',
    notes: 'Cimentos e Materiais de Construção'
  },
  {
    id: 'cli-ambev',
    name: 'Ambev Bebidas e Alimentos',
    shortName: 'Ambev',
    logoUrl: '/assets/logos/ambev.png',
    primaryColor: '#002060',
    defaultSolution: 'SCP (IBP)',
    notes: 'Bebidas e Bens de Consumo'
  },
  {
    id: 'cli-klabin',
    name: 'Klabin Papel e Celulose',
    shortName: 'Klabin',
    logoUrl: '/assets/logos/klabin.png',
    primaryColor: '#006E3C',
    defaultSolution: 'Fábrica',
    notes: 'Embalagens e Celulose Integrada'
  },
  {
    id: 'cli-suzano',
    name: 'Suzano Papel & Logística Global',
    shortName: 'Suzano',
    logoUrl: '/assets/logos/suzano.png',
    primaryColor: '#008264',
    defaultSolution: 'SCE',
    notes: 'Líder Global em Bioprodutos de Eucalipto'
  },
  {
    id: 'cli-raizen',
    name: 'Raízen Combustíveis e Bioenergia',
    shortName: 'Raízen',
    logoUrl: '/assets/logos/raizen.png',
    primaryColor: '#501450',
    defaultSolution: 'RISE',
    notes: 'Energia Renovável e Distribuição de Combustíveis'
  },
  {
    id: 'cli-natura',
    name: 'Natura Cosméticos',
    shortName: 'Natura',
    logoUrl: '/assets/logos/natura.png',
    primaryColor: '#EB6E28',
    defaultSolution: 'Fábrica',
    notes: 'Cosméticos e Sustentabilidade'
  },
  {
    id: 'cli-jbs',
    name: 'JBS Carnes e Exportação',
    shortName: 'JBS',
    logoUrl: '/assets/logos/jbs.png',
    primaryColor: '#BE1414',
    defaultSolution: 'SCE',
    notes: 'Proteína Animal e Exportação Global'
  },
  {
    id: 'cli-petrobras',
    name: 'Petrobras Energia & Biocombustíveis',
    shortName: 'Petrobras',
    logoUrl: '/assets/logos/petrobras.png',
    primaryColor: '#007846',
    defaultSolution: 'RISE',
    notes: 'Energia, Exploração e Refino'
  },
  {
    id: 'cli-vale',
    name: 'Vale Mineração & Metais Básicos',
    shortName: 'Vale',
    logoUrl: '/assets/logos/vale.png',
    primaryColor: '#008080',
    defaultSolution: 'GROW',
    notes: 'Mineração e Logística Ferroviária'
  },
  {
    id: 'cli-weg',
    name: 'WEG Equipamentos Elétricos',
    shortName: 'WEG',
    logoUrl: '/assets/logos/weg.png',
    primaryColor: '#0055A0',
    defaultSolution: 'GROW',
    notes: 'Motores, Automação e Energia'
  },
  {
    id: 'cli-braskem',
    name: 'Braskem Petroquímica Global',
    shortName: 'Braskem',
    logoUrl: '/assets/logos/braskem.png',
    primaryColor: '#0064AA',
    defaultSolution: 'SCP (IBP)',
    notes: 'Resinas Termoplásticas e Química'
  },
  {
    id: 'cli-boticario',
    name: 'Grupo Boticário Beleza & Cosmética',
    shortName: 'Grupo Boticário',
    logoUrl: '/assets/logos/boticario.png',
    primaryColor: '#0F4B4B',
    defaultSolution: 'SCP (IBP)',
    notes: 'Fragrâncias, Beleza e Varejo Multicanal'
  },
  {
    id: 'cli-embraer',
    name: 'Embraer Aeroespacial e Defesa',
    shortName: 'Embraer',
    logoUrl: '/assets/logos/embraer.png',
    primaryColor: '#0A2D6E',
    defaultSolution: 'Fábrica',
    notes: 'Aviação Comercial, Executiva e Defesa'
  },
  {
    id: 'cli-cosan',
    name: 'Cosan Energia & Infraestrutura',
    shortName: 'Cosan',
    logoUrl: '/assets/logos/cosan.png',
    primaryColor: '#143C8C',
    defaultSolution: 'SCE',
    notes: 'Agronegócio, Logística Multimodal e Energia'
  }
];

export const INITIAL_CLIENTS: ClientInfo[] = RAW_CLIENTS.map(c => ({
  ...c,
  status: 'DEMONSTRATIVO' as const
}));

// 15 corporate exemplary projects: exactly 3 projects per front (RISE, GROW, SCP (IBP), Fábrica, SCE)
const RAW_PROJECTS: SapProjectFinancial[] = [
  // --------------------------------------------------------------------------
  // FRENTE 1: RISE (S/4HANA Cloud / Private Edition) - 3 Projetos
  // --------------------------------------------------------------------------
  {
    id: 'proj-001',
    code: 'EXED-SAP-01',
    name: 'Transformação Digital S/4HANA Cloud',
    client: 'Grupo Industrial Gerdau & Cia',
    clientLogo: '/assets/logos/gerdau.png',
    solution: 'RISE',
    projectManager: 'Camila Mendes',
    budgetPlanned: 1850000,
    budgetRealized: 1690000,
    billed: 1650000,
    costVariancePercent: -8.6,
    marginPercent: 28.5,
    trafficTag: 'Verde',
    scheduleDelayPercent: 0.8,
    signedDocumentsPercent: 94,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Marcos entregues dentro do cronograma financeiro do VMO.',
    plannedEndDate: '15/12/2026',
    plannedResources: 26,
    totalResources: 24,
    remainingResources: 6,
    resourceVariancePercent: -4.5,
    reimbursableExpenseTotal: 48500,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '25/08/2026',
    npsScore: 9.8
  },
  {
    id: 'proj-006',
    code: 'EXED-SAP-06',
    name: 'Migração RISE Private Cloud Edition',
    client: 'Raízen Combustíveis e Bioenergia',
    clientLogo: '/assets/logos/raizen.png',
    solution: 'RISE',
    projectManager: 'Camila Mendes',
    budgetPlanned: 2100000,
    budgetRealized: 2020000,
    billed: 1980000,
    costVariancePercent: -3.8,
    marginPercent: 27.2,
    trafficTag: 'Verde',
    scheduleDelayPercent: 1.1,
    signedDocumentsPercent: 85,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Go-live do ciclo contábil concluído com sucesso.',
    plannedEndDate: '15/03/2027',
    plannedResources: 24,
    totalResources: 22,
    remainingResources: 8,
    resourceVariancePercent: -3.6,
    reimbursableExpenseTotal: 52000,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '26/08/2026',
    npsScore: 9.4
  },
  {
    id: 'proj-009',
    code: 'EXED-SAP-09',
    name: 'Modernização ERP S/4HANA RISE',
    client: 'Petrobras Energia & Biocombustíveis',
    clientLogo: '/assets/logos/petrobras.png',
    solution: 'RISE',
    projectManager: 'Camila Mendes',
    budgetPlanned: 2450000,
    budgetRealized: 2380000,
    billed: 2400000,
    costVariancePercent: -2.9,
    marginPercent: 26.8,
    trafficTag: 'Verde',
    scheduleDelayPercent: 0.4,
    signedDocumentsPercent: 91,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Homologação corporativa com alta aderência contábil e fiscal.',
    plannedEndDate: '30/04/2027',
    plannedResources: 28,
    totalResources: 26,
    remainingResources: 9,
    resourceVariancePercent: -2.8,
    reimbursableExpenseTotal: 65400,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '29/08/2026',
    npsScore: 9.6
  },

  // --------------------------------------------------------------------------
  // FRENTE 2: GROW (GROW with SAP / Public Cloud) - 3 Projetos
  // --------------------------------------------------------------------------
  {
    id: 'proj-002',
    code: 'EXED-SAP-02',
    name: 'Implantação GROW SAP Public Cloud',
    client: 'Votorantim Logística e Distribuição',
    clientLogo: '/assets/logos/votorantim.png',
    solution: 'GROW',
    projectManager: 'Eduardo Santos',
    budgetPlanned: 980000,
    budgetRealized: 1045000,
    billed: 950000,
    costVariancePercent: 6.6,
    marginPercent: 19.2,
    trafficTag: 'Amarelo',
    scheduleDelayPercent: 1.4,
    signedDocumentsPercent: 78,
    qaStatus: 'Pendente',
    pendenciesCount: 2,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Desvio pontual devido a adequações fiscais no mês.',
    plannedEndDate: '30/11/2026',
    plannedResources: 18,
    totalResources: 18,
    remainingResources: 4,
    resourceVariancePercent: 7.2,
    reimbursableExpenseTotal: 34200,
    hasOpenCr: true,
    crValue: 145000,
    crOpenDate: '14/08/2026',
    crDescription: 'Adequação fiscal para escrituração digital de fretes no estado de SP.',
    usesCloudAlm: false,
    npsDate: '22/08/2026',
    npsScore: 8.2
  },
  {
    id: 'proj-010',
    code: 'EXED-SAP-10',
    name: 'Expansão GROW SAP Cloud Mid-Market',
    client: 'Vale Mineração & Metais Básicos',
    clientLogo: '/assets/logos/vale.png',
    solution: 'GROW',
    projectManager: 'Eduardo Santos',
    budgetPlanned: 1350000,
    budgetRealized: 1280000,
    billed: 1320000,
    costVariancePercent: -5.2,
    marginPercent: 29.4,
    trafficTag: 'Verde',
    scheduleDelayPercent: 0.7,
    signedDocumentsPercent: 89,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Implementação ágil em subsidiárias de mineração e logística.',
    plannedEndDate: '28/02/2027',
    plannedResources: 16,
    totalResources: 15,
    remainingResources: 5,
    resourceVariancePercent: -3.2,
    reimbursableExpenseTotal: 41000,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '27/08/2026',
    npsScore: 9.3
  },
  {
    id: 'proj-011',
    code: 'EXED-SAP-11',
    name: 'Rollout Global GROW SAP Public Cloud',
    client: 'WEG Equipamentos Elétricos',
    clientLogo: '/assets/logos/weg.png',
    solution: 'GROW',
    projectManager: 'Eduardo Santos',
    budgetPlanned: 1150000,
    budgetRealized: 1190000,
    billed: 1120000,
    costVariancePercent: 3.5,
    marginPercent: 23.5,
    trafficTag: 'Amarelo',
    scheduleDelayPercent: 1.2,
    signedDocumentsPercent: 81,
    qaStatus: 'Pendente',
    pendenciesCount: 1,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Configuração de plantas industriais externas em andamento.',
    plannedEndDate: '15/01/2027',
    plannedResources: 15,
    totalResources: 16,
    remainingResources: 3,
    resourceVariancePercent: 4.8,
    reimbursableExpenseTotal: 29800,
    hasOpenCr: true,
    crValue: 98000,
    crOpenDate: '18/08/2026',
    crDescription: 'Inclusão de localização para três unidades fabris na América Latina.',
    usesCloudAlm: true,
    npsDate: '20/08/2026',
    npsScore: 8.6
  },

  // --------------------------------------------------------------------------
  // FRENTE 3: SCP (IBP) (Supply Chain Planning / Integrated Planning) - 3 Projetos
  // --------------------------------------------------------------------------
  {
    id: 'proj-003',
    code: 'EXED-SAP-03',
    name: 'Planejamento Integrado Supply Chain (IBP)',
    client: 'Ambev Bebidas e Alimentos',
    clientLogo: '/assets/logos/ambev.png',
    solution: 'SCP (IBP)',
    projectManager: 'Beatriz Lima',
    budgetPlanned: 1420000,
    budgetRealized: 1380000,
    billed: 1350000,
    costVariancePercent: -2.8,
    marginPercent: 32.0,
    trafficTag: 'Verde',
    scheduleDelayPercent: 0.5,
    signedDocumentsPercent: 88,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Módulos S&OP e Response & Supply ativados.',
    plannedEndDate: '28/02/2027',
    plannedResources: 16,
    totalResources: 14,
    remainingResources: 3,
    resourceVariancePercent: -2.1,
    reimbursableExpenseTotal: 38700,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '28/08/2026',
    npsScore: 9.5
  },
  {
    id: 'proj-012',
    code: 'EXED-SAP-12',
    name: 'IBP Demand & Supply Optimization',
    client: 'Braskem Petroquímica Global',
    clientLogo: '/assets/logos/braskem.png',
    solution: 'SCP (IBP)',
    projectManager: 'Beatriz Lima',
    budgetPlanned: 1680000,
    budgetRealized: 1610000,
    billed: 1650000,
    costVariancePercent: -4.2,
    marginPercent: 30.5,
    trafficTag: 'Verde',
    scheduleDelayPercent: 0.5,
    signedDocumentsPercent: 93,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Modelagem preditiva de demanda química integrada aos centros de distribuição.',
    plannedEndDate: '31/03/2027',
    plannedResources: 19,
    totalResources: 18,
    remainingResources: 6,
    resourceVariancePercent: -3.8,
    reimbursableExpenseTotal: 44600,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '26/08/2026',
    npsScore: 9.7
  },
  {
    id: 'proj-013',
    code: 'EXED-SAP-13',
    name: 'SAP IBP S&OP Multi-Echelon',
    client: 'Grupo Boticário Beleza & Cosmética',
    clientLogo: '/assets/logos/boticario.png',
    solution: 'SCP (IBP)',
    projectManager: 'Beatriz Lima',
    budgetPlanned: 1290000,
    budgetRealized: 1340000,
    billed: 1250000,
    costVariancePercent: 3.9,
    marginPercent: 22.0,
    trafficTag: 'Amarelo',
    scheduleDelayPercent: 1.5,
    signedDocumentsPercent: 76,
    qaStatus: 'Pendente',
    pendenciesCount: 1,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Ajustes no algoritmo de balanceamento de estoques em lojas físicas.',
    plannedEndDate: '31/01/2027',
    plannedResources: 14,
    totalResources: 15,
    remainingResources: 4,
    resourceVariancePercent: 5.6,
    reimbursableExpenseTotal: 31500,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '23/08/2026',
    npsScore: 8.9
  },

  // --------------------------------------------------------------------------
  // FRENTE 4: Fábrica (Desenvolvimento ABAP, Fiori, BTP e AMS) - 3 Projetos
  // --------------------------------------------------------------------------
  {
    id: 'proj-004',
    code: 'EXED-SAP-04',
    name: 'Fábrica de Desenvolvimento ABAP e Fiori',
    client: 'Klabin Papel e Celulose',
    clientLogo: '/assets/logos/klabin.png',
    solution: 'Fábrica',
    projectManager: 'Ricardo Silva',
    budgetPlanned: 760000,
    budgetRealized: 710000,
    billed: 750000,
    costVariancePercent: -6.5,
    marginPercent: 34.8,
    trafficTag: 'Verde',
    scheduleDelayPercent: 0.9,
    signedDocumentsPercent: 92,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Volumetria de chamados e sprints dentro do teto contratual.',
    plannedEndDate: '31/01/2027',
    plannedResources: 12,
    totalResources: 12,
    remainingResources: 2,
    resourceVariancePercent: -8.0,
    reimbursableExpenseTotal: 18200,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '18/08/2026',
    npsScore: 10.0
  },
  {
    id: 'proj-007',
    code: 'EXED-SAP-07',
    name: 'Fábrica de Integrações SAP CPI / BTP',
    client: 'Natura Cosméticos',
    clientLogo: '/assets/logos/natura.png',
    solution: 'Fábrica',
    projectManager: 'Ricardo Silva',
    budgetPlanned: 890000,
    budgetRealized: 860000,
    billed: 890000,
    costVariancePercent: -3.3,
    marginPercent: 31.5,
    trafficTag: 'Verde',
    scheduleDelayPercent: 0.6,
    signedDocumentsPercent: 74,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'APIs integradas com plataformas externas de e-commerce.',
    plannedEndDate: '30/11/2026',
    plannedResources: 10,
    totalResources: 10,
    remainingResources: 2,
    resourceVariancePercent: 5.1,
    reimbursableExpenseTotal: 22400,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '19/08/2026',
    npsScore: 9.6
  },
  {
    id: 'proj-014',
    code: 'EXED-SAP-014',
    name: 'Fábrica Ágil de Extensões SAP BTP & IA',
    client: 'Embraer Aeroespacial e Defesa',
    clientLogo: '/assets/logos/embraer.png',
    solution: 'Fábrica',
    projectManager: 'Ricardo Silva',
    budgetPlanned: 920000,
    budgetRealized: 880000,
    billed: 910000,
    costVariancePercent: -4.3,
    marginPercent: 33.2,
    trafficTag: 'Verde',
    scheduleDelayPercent: 0.3,
    signedDocumentsPercent: 96,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Aplicações Fiori e microserviços em SAP BTP para manufatura aeronáutica.',
    plannedEndDate: '28/02/2027',
    plannedResources: 13,
    totalResources: 12,
    remainingResources: 3,
    resourceVariancePercent: -6.4,
    reimbursableExpenseTotal: 26800,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '30/08/2026',
    npsScore: 9.9
  },

  // --------------------------------------------------------------------------
  // FRENTE 5: SCE (Supply Chain Execution / EWM & TM) - 3 Projetos
  // --------------------------------------------------------------------------
  {
    id: 'proj-005',
    code: 'EXED-SAP-05',
    name: 'Supply Chain Execution (EWM & TM)',
    client: 'Suzano Papel & Logística Global',
    clientLogo: '/assets/logos/suzano.png',
    solution: 'SCE',
    projectManager: 'Marcelo Souza',
    budgetPlanned: 1250000,
    budgetRealized: 1390000,
    billed: 1200000,
    costVariancePercent: 11.2,
    marginPercent: 14.5,
    trafficTag: 'Vermelho',
    scheduleDelayPercent: 2.8,
    signedDocumentsPercent: 62,
    qaStatus: 'Em Revisão',
    pendenciesCount: 3,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Necessidade de horas extras na parametrização de armazéns 3D.',
    plannedEndDate: '20/12/2026',
    plannedResources: 15,
    totalResources: 16,
    remainingResources: 5,
    resourceVariancePercent: 12.4,
    reimbursableExpenseTotal: 57900,
    hasOpenCr: true,
    crValue: 215000,
    crOpenDate: '22/07/2026',
    crDescription: 'Expansão de escopo para integração com armazéns verticais automatizados.',
    usesCloudAlm: false,
    npsDate: '15/08/2026',
    npsScore: 7.5
  },
  {
    id: 'proj-008',
    code: 'EXED-SAP-08',
    name: 'Otimização Logística SAP Transportation (TM)',
    client: 'JBS Carnes e Exportação',
    clientLogo: '/assets/logos/jbs.png',
    solution: 'SCE',
    projectManager: 'Marcelo Souza',
    budgetPlanned: 1100000,
    budgetRealized: 1170000,
    billed: 1080000,
    costVariancePercent: 6.3,
    marginPercent: 21.0,
    trafficTag: 'Amarelo',
    scheduleDelayPercent: 1.8,
    signedDocumentsPercent: 72,
    qaStatus: 'Pendente',
    pendenciesCount: 1,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Revisão de rotas de frete em fase de validação com stakeholders.',
    plannedEndDate: '28/02/2027',
    plannedResources: 14,
    totalResources: 15,
    remainingResources: 3,
    resourceVariancePercent: 8.3,
    reimbursableExpenseTotal: 36200,
    hasOpenCr: true,
    crValue: 130000,
    crOpenDate: '05/08/2026',
    crDescription: 'Inclusão de módulo de roteirização dinâmica e conciliação de pedágio.',
    usesCloudAlm: false,
    npsDate: '24/08/2026',
    npsScore: 8.8
  },
  {
    id: 'proj-015',
    code: 'EXED-SAP-015',
    name: 'Gestão Avançada de Armazéns SAP EWM',
    client: 'Cosan Energia & Infraestrutura',
    clientLogo: '/assets/logos/cosan.png',
    solution: 'SCE',
    projectManager: 'Marcelo Souza',
    budgetPlanned: 1480000,
    budgetRealized: 1430000,
    billed: 1450000,
    costVariancePercent: -3.4,
    marginPercent: 27.8,
    trafficTag: 'Verde',
    scheduleDelayPercent: 0.6,
    signedDocumentsPercent: 90,
    qaStatus: 'Auditado',
    pendenciesCount: 0,
    sharePointFolder: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=P8c9VL',
    referenceDate: '01/09/2026',
    notes: 'Integração de pátios ferroviários e terminais portuários.',
    plannedEndDate: '30/04/2027',
    plannedResources: 17,
    totalResources: 16,
    remainingResources: 5,
    resourceVariancePercent: -4.1,
    reimbursableExpenseTotal: 43100,
    hasOpenCr: false,
    usesCloudAlm: true,
    npsDate: '28/08/2026',
    npsScore: 9.4
  }
];

export const INITIAL_PROJECTS: SapProjectFinancial[] = RAW_PROJECTS.map(p => ({
  ...p,
  status: 'DEMONSTRATIVO' as const
}));

// Sequence of 6 widgets matching the layout from the reference image
export const INITIAL_WIDGETS: DashboardWidgetConfig[] = [
  {
    id: 'widget-kpi',
    title: 'Resumo Executivo do VMO (KPIs)',
    type: 'kpi-summary',
    order: 1,
    visible: true,
    collapsed: false
  },
  {
    id: 'widget-chart-1',
    title: '1. HISTÓRICO DE % ADERÊNCIA POR MÊS',
    type: 'chart-adherence-trend',
    order: 2,
    visible: true,
    collapsed: false
  },
  {
    id: 'widget-chart-2',
    title: '2. QUANTIDADE DE APURAÇÕES REALIZADAS POR MÊS',
    type: 'chart-qa-volume-monthly',
    order: 3,
    visible: true,
    collapsed: false
  },
  {
    id: 'widget-chart-3',
    title: '3. PENDÊNCIAS APÓS QA POR GP',
    type: 'chart-gp-pendencies',
    order: 4,
    visible: true,
    collapsed: false
  },
  {
    id: 'widget-chart-4',
    title: '4. PENDÊNCIAS APÓS QA POR PROJETO',
    type: 'chart-project-pendencies',
    order: 5,
    visible: true,
    collapsed: false
  },
  {
    id: 'widget-chart-5',
    title: '5. DESEMPENHO E MARGEM POR SOLUÇÃO SAP',
    type: 'chart-solution-compliance',
    order: 6,
    visible: true,
    collapsed: false
  },
  {
    id: 'widget-chart-6',
    title: '6. PROJETOS POR STATUS DO CONTROLE (TRÁFEGO VMO)',
    type: 'chart-control-status',
    order: 7,
    visible: true,
    collapsed: false
  },
  {
    id: 'widget-table',
    title: 'Tabela Executiva de Projetos SAP (VMO Corporativo)',
    type: 'table-projects',
    order: 8,
    visible: true,
    collapsed: false
  }
];

export const DEFAULT_CONTAINER_SETTINGS = {
  // T7 — METAS SEM VALOR PADRÃO.
  // Antes havia `annualRevenueTarget: 120000000` e `contractMarginTarget: 24.0`
  // aqui. Como o dashboard desenhava a linha de meta sempre que o campo tinha
  // valor, uma instalação nova exibia uma "meta de R$ 120 milhões" que ninguém
  // na empresa tinha definido — e que era lida como meta oficial no relatório
  // executivo. Agora nascem indefinidas: sem meta configurada, nenhuma linha de
  // meta é desenhada e as cores usam a média do próprio período como referência.
  annualRevenueTarget: undefined as number | undefined,
  contractMarginTarget: undefined as number | undefined,

  topClientsLimit: 5,
  gaugeMinScale: 94.0,
  governanceComplianceThreshold: 80.0,
  delayRedLimit: 2.0,
  detractorRevenueCutoff: 0,
  docsGreenLimit: 80,
  docsYellowLimit: 70,
  legacyNoticeText: 'Dados antigos não incluídos, controle interno agendado',
  almAdoptionTarget: 80,
  npsPromoterCutoff: 75,
  npsTargetScore: 8.5,
  crHighValueAlert: 100000
};

// ==============================================================================
// LAYOUT DO DASHBOARD: ORDEM E VISIBILIDADE DE PÁGINAS E CONTÊINERES
// ==============================================================================
export const INITIAL_PAGE_LAYOUT: PageLayoutConfig[] = [
  { key: 'one_page', label: 'One Page', order: 0, hidden: false },
  { key: 'pontos_atencao', label: 'Pontos de Atenção', order: 1, hidden: false },
  { key: 'informacoes_gerais', label: 'Informações Gerais', order: 2, hidden: false },
  { key: 'detalhamento_financeiro', label: 'Detalhamento Financeiro', order: 3, hidden: false }
];

export const INITIAL_CONTAINER_LAYOUT: ContainerLayoutConfig[] = [
  { id: 'one_page__principais_informacoes', pageKey: 'one_page', label: 'Principais Informações do Mês', order: 0, hidden: false },
  { id: 'one_page__meta_receita', pageKey: 'one_page', label: 'Receita Acumulada (Burnup)', order: 1, hidden: false },
  { id: 'one_page__meta_margem', pageKey: 'one_page', label: 'Evolução da Margem', order: 2, hidden: false },
  { id: 'one_page__contribuicoes_metas', pageKey: 'one_page', label: 'Contribuições por Cliente', order: 3, hidden: false },

  { id: 'pontos_atencao__detratores', pageKey: 'pontos_atencao', label: 'Projetos Detratores', order: 0, hidden: false },
  { id: 'pontos_atencao__cronogramas', pageKey: 'pontos_atencao', label: 'Aderência aos Cronogramas e Atrasos', order: 1, hidden: false },
  { id: 'pontos_atencao__documentacao', pageKey: 'pontos_atencao', label: 'Documentação Registrada ao PMO', order: 2, hidden: false },

  { id: 'informacoes_gerais__orcamento', pageKey: 'informacoes_gerais', label: 'Projetos com Maior Uso de Orçamento', order: 0, hidden: false },
  { id: 'informacoes_gerais__crs_abertos', pageKey: 'informacoes_gerais', label: 'CRs em Aberto', order: 1, hidden: false },
  { id: 'informacoes_gerais__uso_alm', pageKey: 'informacoes_gerais', label: 'Uso de ALM', order: 2, hidden: false },
  { id: 'informacoes_gerais__avaliacoes', pageKey: 'informacoes_gerais', label: 'Avaliações (NPS)', order: 3, hidden: false },

  { id: 'detalhamento_financeiro__tabela', pageKey: 'detalhamento_financeiro', label: 'Tabela de Detalhamento Financeiro', order: 0, hidden: false }
];

// ==============================================================================
// HISTÓRICO MENSAL DE INDICADORES AGREGADOS (para os gráficos comparativos)
// ==============================================================================
// Vazio por padrão de propósito: preferimos mostrar "sem dados ainda" a
// inventar números. É preenchido pela migração (Claude) ou manualmente em
// Configurações > Layout do Dashboard > Histórico Mensal.
export const INITIAL_MONTHLY_HISTORY: MonthlyKpiSnapshot[] = [];
