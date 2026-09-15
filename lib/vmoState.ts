import fs from 'fs';
import path from 'path';
import {
  INITIAL_PROJECTS,
  INITIAL_CLIENTS,
  INITIAL_WIDGETS,
  INITIAL_SHAREPOINT_LINKS,
  DEFAULT_CONTAINER_SETTINGS,
  INITIAL_PAGE_LAYOUT,
  INITIAL_CONTAINER_LAYOUT,
  INITIAL_MONTHLY_HISTORY
} from '../src/data/initialData.js';
import { calculateVmoReferencePeriod } from '../src/utils/dateUtils.js';
import {
  SapProjectFinancial,
  ClientInfo,
  DashboardWidgetConfig,
  SharePointFolderLink,
  ContainerParamSettings,
  VmoReferencePeriod,
  AppTheme,
  PageLayoutConfig,
  ContainerLayoutConfig,
  MonthlyKpiSnapshot
} from '../src/types.js';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from './supabaseAdmin.js';

// ==============================================================================
// ESTADO COMPLETO DO WEBAPP EXPOSTO/EDITADO PELA API DO CLAUDE
// ==============================================================================
// Onde o estado é persistido:
//  - Se SUPABASE_SERVICE_ROLE_KEY + SUPABASE_URL (ou VITE_SUPABASE_URL) estiverem
//    configuradas: é salvo na tabela `vmo_app_state` do Supabase (recomendado,
//    funciona na Vercel).
//  - Caso contrário: cai para um arquivo JSON local em /data (útil apenas para
//    rodar localmente com `npm run dev`; NÃO persiste em produção na Vercel,
//    pois o sistema de arquivos de Serverless Functions é efêmero).

export interface ServerVmoState {
  instrucoesPreenchimento: string;
  /**
   * Versão do texto de instruções. Ver migrarEstadoCarregado() logo abaixo:
   * é o que permite substituir instruções antigas já gravadas no Supabase sem
   * atropelar o texto que o PMO tenha editado depois da atualização.
   */
  instrucoesVersao?: number;
  localDosDados: string;
  projects: SapProjectFinancial[];
  clients: ClientInfo[];
  widgets: DashboardWidgetConfig[];
  sharePointLinks: SharePointFolderLink[];
  containerSettings: ContainerParamSettings;
  referencePeriod: VmoReferencePeriod;
  theme: AppTheme;
  pageLayout: PageLayoutConfig[];
  containerLayout: ContainerLayoutConfig[];
  monthlyHistory: MonthlyKpiSnapshot[];
  lastSaved: string;
  updatedBy?: string;
}

export const DEFAULT_INSTRUCOES_PREENCHIMENTO = `===============================================================================
INSTRUÇÕES DE MIGRAÇÃO DE DADOS DO SHAREPOINT PARA O WEBAPP VMO — EXED CONSULTING
===============================================================================

-------------------------------------------------------------------------------
0. FONTE DOS DADOS — REGRA ABSOLUTA
-------------------------------------------------------------------------------
A ÚNICA fonte de dados deste webapp é o SharePoint corporativo da Exed, no
caminho indicado em LOCAL_DOS_DADOS. Não existe nenhuma outra origem.

Se algum arquivo, conversa ou anotação sugerir outra fonte, ignore: está
desatualizado. Não procure os dados em nenhum outro lugar e não peça ao usuário
acesso a outro repositório.

-------------------------------------------------------------------------------
1. ESTRUTURA DE PASTAS ESPERADA
-------------------------------------------------------------------------------
O caminho até uma planilha segue este padrão:

  AAAAMM_Mês / AAAAMMDD - Delivery / Dashboard - ... /
    AAAAMMDD_PMO RSE_<PORTFOLIO>_<CLIENTE>_<PROJETO>.xlsm

Exemplos de pasta de mês: 202601_Janeiro, 202602_Fevereiro, 202609_Setembro.

Dentro de cada pasta de mês há subpastas datadas, e dentro delas as subpastas de
dashboard (ex: "Dashboard - RISE + FSW", "Dashboard - GROW + DSC") com os
arquivos .xlsm.

SEJA ADAPTATIVO: a estrutura acima é a observada, mas pode variar de mês para
mês. Se não encontrar as subpastas esperadas, NÃO desista — faça uma busca
recursiva dentro da pasta do mês por qualquer arquivo cujo nome contenha "RSE".
O critério de "isso é fonte de dado válida" é o nome do arquivo, não o da pasta.

-------------------------------------------------------------------------------
2. QUAL ARQUIVO É FONTE VÁLIDA
-------------------------------------------------------------------------------
SÓ processe arquivos cujo nome contenha "PMO RSE_".

ARMADILHA DE NOME: existe "PMO RISE_..." (com I antes do S). NÃO é arquivo
válido e deve ser ignorado — mesmo que "RISE" também apareça como nome de
solução dentro dos arquivos RSE válidos (ex: "PMO RSE_RISE_Cogna..." é válido:
"RSE" é o prefixo do PMO e "RISE" depois é a solução SAP). O que importa é o
que vem logo após "PMO ": tem que ser "RSE".

Ignore também os arquivos soltos de apresentação (PDF/PPTX) e qualquer .xlsm
cujo nome não contenha "RSE".

-------------------------------------------------------------------------------
3. IDENTIDADE DO PROJETO — NUNCA PELO NOME DO ARQUIVO
-------------------------------------------------------------------------------
A identidade de um projeto é o campo "Project ID (S4 Public Exed)" de dentro da
planilha. NUNCA o nome do arquivo.

Motivo: os nomes mudam entre semanas. O mesmo projeto aparece como
"CSN_PROJETO_DELTA", depois "CSN_PROJETO_DELTA_v2", depois "..._v3". Usar o nome
como chave cria projetos duplicados e quebra todo o comparativo mês a mês.

Use esse Project ID como "id" do projeto no webapp E como "projectId" dentro de
"projectSnapshots" no histórico mensal. É esse identificador que permite calcular
a variação de um projeto entre dois meses.

-------------------------------------------------------------------------------
4. PORTFÓLIO — NÃO CONFIE NO RÓTULO DA PASTA
-------------------------------------------------------------------------------
Os rótulos das subpastas ("RISE + FSW", "GROW + DSC") são organização interna do
PMO e NÃO são fonte confiável de portfólio.

Use sempre o campo "Project Portfolio" de dentro da planilha.

-------------------------------------------------------------------------------
5. SUPERFÍCIE DE LEITURA: A ABA "MIRROR ACTUAL"
-------------------------------------------------------------------------------
Leia a aba "MIRROR ACTUAL". Ela é uma lista chave-valor das linhas 1 a 1084, já
preparada para leitura automática.

NÃO raspe as abas visuais (GERAL STATUS, BILLING, QUALITY GATE etc.). Elas são
formatação para humanos; a posição das células muda e a leitura quebra.

CADA ARQUIVO TRAZ DUAS SEMANAS, não o histórico inteiro:
  - "MIRROR ACTUAL" → a semana corrente do arquivo
  - "LAST STATUS"   → a semana anterior

Ou seja: para montar nove meses de histórico é preciso abrir os arquivos dos
nove meses. Não existe um arquivo único com tudo.

-------------------------------------------------------------------------------
6. A QUE MÊS OS DADOS PERTENCEM
-------------------------------------------------------------------------------
NÃO confie na data do nome do arquivo ou da pasta: ela indica quando a revisão
aconteceu, não o mês de referência dos números (uma pasta do início de agosto
pode conter o fechamento de julho).

A fonte confiável é o campo "Status Date" dentro da planilha. Confirme que ele
cai dentro do mês-alvo antes de usar qualquer número do arquivo. Se não bater,
procure a pasta adjacente (mês anterior ou seguinte) até achar o Status Date
certo.

Se perceber um padrão estável ("a pasta do início do mês X sempre reporta o
fechamento de X-1"), pode usá-lo para ir direto à pasta certa — mas confirme
abrindo ao menos uma planilha de cada mês antes de confiar no padrão.

-------------------------------------------------------------------------------
7. O QUE EXTRAIR POR PROJETO
-------------------------------------------------------------------------------
Da lista chave-valor de "MIRROR ACTUAL", monte cada projeto com:

  id / code            ← Project ID (S4 Public Exed)
  client               ← cliente
  name                 ← nome do projeto
  solution             ← Project Portfolio (RISE, GROW, SCP (IBP), Fábrica, SCE)
  projectManager       ← gerente responsável
  budgetPlanned        ← Revenue (CTR + CR)
  budgetRealized       ← custo real incorrido (Actual Cost)
  billed               ← total já faturado ao cliente até o Status Date
  marginPercent        ← Forecast Margin × 100
  costVariancePercent  ← ((budgetRealized - budgetPlanned) / budgetPlanned) × 100
  trafficTag           ← Temperatura (Green→Verde, Yellow→Amarelo, Red→Vermelho)
  scheduleDelayPercent ← (1 - SPI) × 100
  npsScore / npsDate   ← bloco de NPS
  usesCloudAlm         ← SAP Cloud ALM ("Not" = false)
  hasOpenCr            ← CR ("Not" = false)
  crValue / crOpenDate / crDescription ← quando houver CR aberta
  signedDocumentsPercent ← % de documentos concluídos no quality gate
  plannedEndDate       ← data de encerramento planejada
  referenceDate        ← o Status Date real
  sharePointFolder     ← caminho completo do arquivo de origem
  status               ← "ATIVO", salvo se claramente encerrado

CAMPO SEM CÉLULA CORRESPONDENTE: deixe em branco. NÃO invente valor e não deixe
de migrar o projeto por causa disso. O PMO completa depois pelas telas de
Projetos e de Histórico Mensal em Configurações.

-------------------------------------------------------------------------------
8. HISTÓRICO MENSAL — O QUE ALIMENTA TODOS OS COMPARATIVOS
-------------------------------------------------------------------------------
Para CADA mês processado, monte um item de histórico. É ele que alimenta os
comparativos "vs mês anterior" das quatro páginas do dashboard.

OBRIGATÓRIOS:
  monthKey       "AAAA-MM" (ex: "2026-03")
  year, month
  revenueBilled  faturamento DAQUELE mês (não acumulado) — some as linhas de
                 faturamento com data efetiva dentro do mês, de todos os projetos
  marginAvg      média das margens dos projetos daquele mês

OPCIONAIS (cada um liga um comparativo; sem ele o dashboard mostra "—"):
  totalSpend           gasto/uso de orçamento total do mês
  clientsServed        clientes distintos atendidos no mês
  goLivesCompleted     go-lives concluídos no mês
  activeProjects       projetos ativos no mês
  avgScheduleDelay     atraso médio de cronograma (%)
  npsAvg               NPS médio do mês (0 a 10)
  signedDocsAvg        % médio de documentação assinada
  detractorCount       projetos abaixo da referência de receita ou margem
  almAdoptionPercent   % de projetos usando SAP Cloud ALM
  openCrCount          quantidade de CRs em aberto
  openCrValue          valor somado das CRs em aberto
  plannedBudgetTotal   uso de orçamento planejado total
  reimbursableTotal    total de gasto reembolsável do mês

REGRA DE OURO: se o dado não existir para um mês, OMITA o campo. Não envie zero.
Zero e "sem dado" são coisas diferentes: zero vira uma variação real no
relatório executivo, "sem dado" vira "—". Enviar zero por ausência produz
comparativos falsos.

DETALHE POR PROJETO — "projectSnapshots":
Inclua, em cada mês, um array com um item por projeto:
  { projectId, client, solution, budgetRealized, billed, marginPercent,
    reimbursableExpenseTotal }
"projectId" É o Project ID (S4 Public Exed) da seção 3.

Isso é o que faz a coluna "Comparativo Mês Ant." das tabelas ser CALCULADA em
vez de digitada à mão pelo PMO. Com dois meses de projectSnapshots, o cálculo
assume sozinho. Sem eles, a coluna cai no valor manual ou mostra "—".

-------------------------------------------------------------------------------
9. COMO ESCREVER NO WEBAPP
-------------------------------------------------------------------------------
Toda escrita exige o cabeçalho "x-api-key: <chave>".

Ferramentas MCP (preferidas):
  ler_estado_vmo           lê o estado; use "secao" para não puxar tudo
  listar_projetos          lista compacta, para conferir antes de escrever
  substituir_projetos      SUBSTITUI O ARRAY INTEIRO
  upsert_historico_mensal  merge por monthKey
  atualizar_estado_vmo     payload parcial genérico

Rotas HTTP equivalentes:
  GET  /api/vmo/state      lê tudo
  POST /api/vmo/state      atualização parcial
  GET  /api/vmo/health     diagnóstico (chave, Supabase, endpoints)

DUAS SEMÂNTICAS DIFERENTES — preste atenção:

  "substituir_projetos" TROCA O ARRAY TODO. Sempre envie a lista COMPLETA,
  incluindo os projetos que não mudaram. Enviar só os alterados APAGA o resto.
  Faça "listar_projetos" antes.

  "upsert_historico_mensal" faz MERGE por monthKey. É seguro para carga
  incremental: enviar só o mês novo não apaga os meses já migrados. Se o
  monthKey já existir, os valores são SUBSTITUÍDOS (não duplicados).

-------------------------------------------------------------------------------
10. ROTEIRO DE MIGRAÇÃO
-------------------------------------------------------------------------------
CARGA COMPLETA DO HISTÓRICO:
  1. Liste as pastas de mês em ordem cronológica.
  2. Para cada mês, na ordem: localize os arquivos "PMO RSE_", confirme o Status
     Date (seção 6), leia "MIRROR ACTUAL" de cada um.
  3. Monte o item de histórico do mês (seção 8), com projectSnapshots.
  4. Envie com "upsert_historico_mensal" ANTES de passar para o mês seguinte.
     Trabalhe em lotes e confira com o usuário a cada lote.
  5. Ao final, envie os dados detalhados por projeto APENAS do mês mais recente
     com "substituir_projetos" — é essa lista que aparece nas tabelas de
     projetos. Os meses anteriores ficam representados pelo histórico.

ATUALIZAÇÃO DE ROTINA (só o mês corrente):
  1. Localize a pasta do mês e confirme o Status Date.
  2. Processe os arquivos "PMO RSE_".
  3. "substituir_projetos" com a lista completa do mês.
  4. "upsert_historico_mensal" com o item daquele mês, incluindo projectSnapshots
     — mesmo no modo "só mês atual", sempre atualize o histórico, senão os
     comparativos param de funcionar.

Ao final, relate: quantos meses e projetos foram processados, quais campos
ficaram em branco, e qualquer inconsistência (Status Date que não bateu, solução
que não mapeou, Project ID ausente).

-------------------------------------------------------------------------------
AVISO GERAL
-------------------------------------------------------------------------------
A estrutura interna das planilhas RSE é a mesma em todos os projetos, então o
mapeamento acima vale para qualquer arquivo RSE. Ainda assim, detalhes podem
exigir ajuste na prática (uma planilha com célula fora do lugar, um mês com
estrutura de pastas diferente). Quando um campo genuinamente não existir, deixe
em branco em vez de inventar. Só pare e pergunte ao usuário se algo impedir a
migração por completo (não conseguir acessar a pasta, arquivo corrompido).`;

// ==============================================================================
// MIGRAÇÃO DE ESTADO JÁ GRAVADO
// ==============================================================================
// O estado vive no Supabase e sobrevive a deploys. Isso significa que mudar um
// valor padrão no código NÃO altera o que já está salvo: uma instalação que já
// rodou continua servindo as instruções antigas e a meta antiga para sempre.
//
// Daí esta migração. Ela roda em toda leitura e corrige duas coisas:
//
//  1. INSTRUÇÕES — substituídas quando a versão gravada é anterior à atual E o
//     texto salvo não parece ter sido editado à mão (ou seja, ainda é a versão
//     antiga de fábrica). Se o PMO editou o texto depois da atualização, a
//     versão já estará em dia e nada é tocado.
//
//  2. META DE RECEITA/MARGEM — o valor 120000000 (e a margem 24) eram defaults
//     de fábrica que nunca foram decididos pela empresa, mas apareciam no
//     relatório como meta oficial. Quando o estado gravado tem EXATAMENTE esses
//     valores de fábrica, eles são limpos. Um número diferente significa que
//     alguém configurou de propósito, e é preservado.
// ==============================================================================
export const INSTRUCOES_VERSAO_ATUAL = 2;

const META_RECEITA_DE_FABRICA = 120000000;
const META_MARGEM_DE_FABRICA = 24;

function pareceInstrucaoDeFabricaAntiga(texto: string): boolean {
  if (!texto || !texto.trim()) return true;
  // A versão nova é reconhecível por estes marcadores. Se faltarem os dois, o
  // texto é anterior à atualização.
  return !texto.includes('MIRROR ACTUAL') && !texto.includes('Project ID (S4 Public Exed)');
}

function migrarEstadoCarregado(state: ServerVmoState): ServerVmoState {
  const versao = state.instrucoesVersao ?? 0;

  if (versao < INSTRUCOES_VERSAO_ATUAL && pareceInstrucaoDeFabricaAntiga(state.instrucoesPreenchimento)) {
    console.info(
      '[vmoState] Instruções gravadas eram da versão antiga de fábrica — substituídas pela versão ' +
        INSTRUCOES_VERSAO_ATUAL +
        '.'
    );
    state.instrucoesPreenchimento = DEFAULT_INSTRUCOES_PREENCHIMENTO;
  }
  state.instrucoesVersao = INSTRUCOES_VERSAO_ATUAL;

  const cfg: any = state.containerSettings;
  if (cfg) {
    if (cfg.annualRevenueTarget === META_RECEITA_DE_FABRICA) {
      console.info('[vmoState] Meta anual de receita era o default de fábrica (120M) — removida.');
      delete cfg.annualRevenueTarget;
    }
    if (cfg.contractMarginTarget === META_MARGEM_DE_FABRICA) {
      console.info('[vmoState] Meta de margem era o default de fábrica (24%) — removida.');
      delete cfg.contractMarginTarget;
    }
  }

  return state;
}

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'vmo_server_state.json');
const SUPABASE_TABLE = 'vmo_app_state';
const SUPABASE_ROW_ID = 'singleton';

function buildDefaultState(): ServerVmoState {
  return {
    instrucoesPreenchimento: DEFAULT_INSTRUCOES_PREENCHIMENTO,
    instrucoesVersao: INSTRUCOES_VERSAO_ATUAL,
    localDosDados: 'https://uh924mhkawsbhi.sharepoint.com/:f:/s/PMO-FernandoAlineeYara/IgBh685D7ekuSboCSaMizjfxAa7INRhp9fYLo6OoVXLlq-U?e=xvwrvt',
    projects: INITIAL_PROJECTS,
    clients: INITIAL_CLIENTS,
    widgets: INITIAL_WIDGETS,
    sharePointLinks: INITIAL_SHAREPOINT_LINKS,
    containerSettings: DEFAULT_CONTAINER_SETTINGS,
    referencePeriod: calculateVmoReferencePeriod(new Date()),
    theme: 'neon',
    pageLayout: INITIAL_PAGE_LAYOUT,
    containerLayout: INITIAL_CONTAINER_LAYOUT,
    monthlyHistory: INITIAL_MONTHLY_HISTORY,
    lastSaved: new Date().toISOString(),
    updatedBy: 'sistema-inicial'
  };
}

function readStateFromDisk(): ServerVmoState | null {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.projects)) {
        return {
          ...parsed,
          sharePointLinks: Array.isArray(parsed.sharePointLinks) && parsed.sharePointLinks.length > 0
            ? parsed.sharePointLinks
            : INITIAL_SHAREPOINT_LINKS,
          instrucoesPreenchimento: parsed.instrucoesPreenchimento || DEFAULT_INSTRUCOES_PREENCHIMENTO,
          pageLayout: Array.isArray(parsed.pageLayout) && parsed.pageLayout.length > 0
            ? parsed.pageLayout
            : INITIAL_PAGE_LAYOUT,
          containerLayout: Array.isArray(parsed.containerLayout) && parsed.containerLayout.length > 0
            ? parsed.containerLayout
            : INITIAL_CONTAINER_LAYOUT,
          monthlyHistory: Array.isArray(parsed.monthlyHistory) ? parsed.monthlyHistory : INITIAL_MONTHLY_HISTORY
        };
      }
    }
  } catch (err) {
    console.warn('[vmoState] Não foi possível ler o arquivo local de estado:', err);
  }
  return null;
}

function writeStateToDisk(state: ServerVmoState): void {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err: any) {
    // Em ambientes serverless (Vercel) o filesystem costuma ser somente leitura
    // fora de /tmp — isso é esperado e inofensivo quando o Supabase está
    // configurado corretamente (o aviso abaixo é só informativo).
    console.warn(
      '[vmoState] Não foi possível gravar o arquivo local de estado (normal em ambiente serverless):',
      err?.message || err
    );
  }
}

export async function loadState(): Promise<ServerVmoState> {
  if (isSupabaseAdminConfigured()) {
    const client = getSupabaseAdminClient();
    try {
      const { data, error } = await client!
        .from(SUPABASE_TABLE)
        .select('state_json')
        .eq('id', SUPABASE_ROW_ID)
        .maybeSingle();

      if (error) {
        // Erro real (rede, credenciais, tabela ausente, etc.) — NÃO tratamos
        // isso como "primeira execução", para não sobrescrever um estado que
        // já existe. Caímos para o cache local e tentamos de novo na próxima.
        console.warn('[vmoState] Erro ao ler estado do Supabase, usando fallback local:', error.message);
      } else if (data?.state_json) {
        const stored = data.state_json as ServerVmoState;
        return migrarEstadoCarregado({
          ...stored,
          pageLayout: Array.isArray(stored.pageLayout) && stored.pageLayout.length > 0
            ? stored.pageLayout
            : INITIAL_PAGE_LAYOUT,
          containerLayout: Array.isArray(stored.containerLayout) && stored.containerLayout.length > 0
            ? stored.containerLayout
            : INITIAL_CONTAINER_LAYOUT,
          monthlyHistory: Array.isArray(stored.monthlyHistory) ? stored.monthlyHistory : INITIAL_MONTHLY_HISTORY
        });
      } else {
        // Sem erro e sem linha encontrada: é de fato a primeira execução.
        // Cria o estado padrão agora, para as próximas leituras já virem do Supabase.
        const initial = buildDefaultState();
        await saveState(initial);
        return initial;
      }
    } catch (err) {
      console.warn('[vmoState] Falha ao conectar ao Supabase, usando fallback local:', err);
    }
  }

  const doDisco = readStateFromDisk();
  return doDisco ? migrarEstadoCarregado(doDisco) : buildDefaultState();
}

/**
 * Aplica, no objeto de estado em memória, os campos enviados pelo Claude (ou
 * pelo próprio webapp) via POST/PUT/PATCH em /api/vmo/state. Aceita tanto os
 * nomes em português (compatibilidade com o formato de leitura) quanto em
 * inglês (nomes internos do TypeScript).
 */
export function applyIncomingUpdates(state: ServerVmoState, body: any): void {
  // 1. Instruções para Preenchimento
  if (typeof body.INSTRUCOES_PARA_PREENCHIMENTO === 'string') {
    state.instrucoesPreenchimento = body.INSTRUCOES_PARA_PREENCHIMENTO;
  } else if (typeof body.instrucoesPreenchimento === 'string') {
    state.instrucoesPreenchimento = body.instrucoesPreenchimento;
  } else if (typeof body.instrucoes_preenchimento === 'string') {
    state.instrucoesPreenchimento = body.instrucoes_preenchimento;
  }

  // 2. Local dos Dados (SharePoint)
  if (typeof body.LOCAL_DOS_DADOS === 'string') {
    state.localDosDados = body.LOCAL_DOS_DADOS;
  } else if (typeof body.localDosDados === 'string') {
    state.localDosDados = body.localDosDados;
  } else if (typeof body.local_dos_dados === 'string') {
    state.localDosDados = body.local_dos_dados;
  }

  // 3. Projetos
  const incomingProjects = body.projects || body.projetos || body.dados?.projetos;
  if (Array.isArray(incomingProjects)) {
    state.projects = incomingProjects;
  }

  // 4. Clientes
  const incomingClients = body.clients || body.clientes || body.dados?.clientes;
  if (Array.isArray(incomingClients)) {
    state.clients = incomingClients;
  }

  // 5. Configurações de Contêineres
  const incomingContainers = body.containerSettings || body.configuracao_conteineres || body.dados?.configuracao_conteineres;
  if (incomingContainers && typeof incomingContainers === 'object') {
    state.containerSettings = { ...state.containerSettings, ...incomingContainers };
  }

  // 6. Links do SharePoint
  const incomingLinks = body.sharePointLinks || body.links_sharepoint || body.dados?.links_sharepoint;
  if (Array.isArray(incomingLinks)) {
    state.sharePointLinks = incomingLinks;
  }

  // 7. Widgets
  const incomingWidgets = body.widgets || body.dados?.widgets;
  if (Array.isArray(incomingWidgets)) {
    state.widgets = incomingWidgets;
  }

  // 8. Período de Referência
  const incomingPeriod = body.referencePeriod || body.periodo_referencia || body.dados?.periodo_referencia;
  if (incomingPeriod && typeof incomingPeriod === 'object') {
    state.referencePeriod = { ...state.referencePeriod, ...incomingPeriod };
  }

  // 9. Tema
  if (body.theme || body.tema) {
    state.theme = body.theme || body.tema;
  }

  // 10. Layout de Páginas (ordem e visibilidade)
  const incomingPageLayout = body.pageLayout || body.layout_paginas;
  if (Array.isArray(incomingPageLayout) && incomingPageLayout.length > 0) {
    state.pageLayout = incomingPageLayout;
  }

  // 11. Layout de Contêineres (ordem e visibilidade)
  const incomingContainerLayout = body.containerLayout || body.layout_conteineres;
  if (Array.isArray(incomingContainerLayout) && incomingContainerLayout.length > 0) {
    state.containerLayout = incomingContainerLayout;
  }

  // 12. Histórico Mensal (indicadores agregados para os gráficos comparativos)
  // IMPORTANTE: faz merge por monthKey (upsert), nunca substitui o array
  // inteiro — assim, atualizar só o mês atual não apaga os meses já migrados.
  const incomingMonthlyHistory = body.monthlyHistory || body.historico_mensal;
  if (Array.isArray(incomingMonthlyHistory) && incomingMonthlyHistory.length > 0) {
    const byKey = new Map<string, any>();
    (state.monthlyHistory || []).forEach(entry => byKey.set(entry.monthKey, entry));
    incomingMonthlyHistory.forEach((entry: any) => {
      if (entry && entry.monthKey) byKey.set(entry.monthKey, entry);
    });
    state.monthlyHistory = Array.from(byKey.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }
}

export async function saveState(state: ServerVmoState): Promise<void> {
  state.lastSaved = new Date().toISOString();

  if (isSupabaseAdminConfigured()) {
    const client = getSupabaseAdminClient();
    try {
      const { error } = await client!
        .from(SUPABASE_TABLE)
        .upsert({ id: SUPABASE_ROW_ID, state_json: state, updated_at: state.lastSaved });

      if (!error) return;
      console.warn('[vmoState] Falha ao gravar estado no Supabase:', error.message);
    } catch (err) {
      console.warn('[vmoState] Erro ao gravar estado no Supabase:', err);
    }
  }

  writeStateToDisk(state);
}
