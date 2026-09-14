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
Estas instruções foram escritas após análise real da estrutura de pastas do
SharePoint e de uma planilha de exemplo real. Siga-as literalmente. Se algo
não bater com o que você encontrar (nomes de pasta diferentes, campos que não
existem numa planilha específica), pare e avise o usuário em vez de adivinhar.

-------------------------------------------------------------------------------
1. ONDE ESTÃO OS DADOS (estrutura de pastas)
-------------------------------------------------------------------------------
Pasta raiz do ano (link em LOCAL_DOS_DADOS): "2.Portfolio_2026"

Dentro dela, uma subpasta por mês:
  202601_Janeiro, 202602_Fevereiro, 202603_Março, 202604_Abril, 202605_Maio,
  202606_Junho, 202607_Julho, 202608_Agosto, 202609_Setembro, (e assim por
  diante conforme o ano avança).

Dentro de CADA mês, existem várias subpastas datadas, ex:
  20260105 - Delivery
  20260112 - Executiva
  20260119 - Delivery
  20260126 - Executiva

REGRA: só as pastas cujo nome contém "Executiva" têm os dados que importam
(as pastas "Delivery" não têm a mesma estrutura e devem ser ignoradas). Se um
mês tiver mais de uma pasta "- Executiva", use a de data mais recente (maior
AAAAMMDD) dentro daquele mês como a mais atualizada — mas veja a REGRA CRÍTICA
da seção 3 antes de decidir a qual mês uma planilha realmente pertence.

Dentro de cada pasta "...- Executiva" existem, NA ESTRUTURA PADRÃO OBSERVADA:
  - Duas subpastas: "Dashboard - GROW + DSC" e "Dashboard - RISE + FSW"
    → É AQUI DENTRO que estão as planilhas de dados válidas.
  - Arquivos soltos (PDF/PPTX de apresentação executiva, e às vezes um .xlsm
    cujo nome NÃO contém "RSE") → IGNORE esses arquivos soltos. Eles são
    material de apresentação, não fonte de dado.

IMPORTANTE — SEJA ADAPTATIVO: a estrutura acima é a observada até agora, mas
pode variar de mês para mês (nomes de subpasta diferentes, mais ou menos
subpastas, organização distinta). Se não encontrar essas duas subpastas
exatas dentro de uma pasta "Executiva", NÃO desista — faça uma busca mais
ampla (recursiva) dentro daquela pasta do mês por qualquer arquivo cujo nome
contenha "RSE" (respeitando a regra da seção 2 sobre "RSE" vs "RISE"),
não importa em qual subpasta esteja. O critério real de "isso é uma fonte de
dado válida" é sempre o nome do arquivo conter "RSE", não o nome da pasta.

-------------------------------------------------------------------------------
2. REGRA CRÍTICA: QUAL ARQUIVO É FONTE DE DADO VÁLIDA
-------------------------------------------------------------------------------
Dentro das pastas "Dashboard - GROW + DSC" e "Dashboard - RISE + FSW", cada
projeto tem seu próprio arquivo .xlsm, com nomes como:
  20260112_PMO RSE_FSW_Votorantim_COL - Squad.xlsm
  20260112_PMO RSE_RISE_Cogna_Digital Finance.xlsm
  20260112_PMO RSE_GROW_Credsystem_S4HPublic.xlsm
  20260112_PMO RSE_SCP_Gerdau S&OE.xlsm

SÓ processe arquivos cujo nome contenha "RSE" (maiúsculo, como parte de
"PMO RSE_..."). Preste atenção: existe uma armadilha de nome parecido —
um arquivo chamado "PMO RISE_..." (com I antes do S, ex: "PMO RISE_Vivara_
Upgrade.xlsm") NÃO é um arquivo RSE válido e deve ser ignorado, mesmo que
"RISE" também apareça como nome de solução dentro dos arquivos RSE válidos
(ex: "PMO RSE_RISE_Cogna..." — aqui "RSE" é o prefixo do PMO e "RISE" depois
é a solução SAP, isso É válido). O que importa é o prefixo logo após "PMO ":
tem que ser "RSE", não "RISE".

Do nome do arquivo, extraia:
  - CLIENTE: a palavra depois do código de solução (ex: "Cogna", "Votorantim",
    "Gerdau", "Credsystem", "Cristoro", "Omni", "Vibra Energia", "Ipiranga",
    "Tramontina", "Vivara"). Limpe sufixos como "_Squad", "DRC", "S4HPublic"
    do nome do cliente quando fizer sentido.

  - SOLUÇÃO: NÃO tente adivinhar a solução pelo nome da pasta ou do arquivo
    (os códigos como FSW/DSC no nome são só organização interna do PMO, não
    a solução real). A fonte confiável é a própria planilha: aba
    "GERAL STATUS", célula ao lado do rótulo " Project:" — o valor vem no
    formato "SOLUÇÃO | Nome do Projeto" (ex: "RISE | Digital Finance"). Use a
    parte antes do "|" como solução (ex: "RISE") e a parte depois como base
    do nome do projeto. Essa string já deve bater com um dos valores usados
    pelo webapp (RISE, GROW, SCP (IBP), Fábrica, SCE) na maioria dos casos;
    se vier algo que não bate exatamente, use o mais parecido e sinalize a
    divergência no resumo final ao usuário.

-------------------------------------------------------------------------------
3. REGRA CRÍTICA: A QUE MÊS OS DADOS DE UMA PLANILHA PERTENCEM
-------------------------------------------------------------------------------
NÃO confie na data que aparece no nome do arquivo ou da pasta para decidir a
qual mês os dados pertencem — essa data é apenas quando a revisão executiva
aconteceu, e pode não corresponder ao mês de referência dos números (ex: uma
pasta datada de início de agosto pode conter o fechamento de julho).

A fonte confiável é o campo "Status Date" DENTRO da própria planilha:
  - Aba "GERAL STATUS", célula ao lado do rótulo "Status date" (perto do
    topo, junto ao bloco de KPIs), OU
  - Aba "PROJECT DATA", linha do campo "Status Date".
Essa data (ex: 31/07/2026) diz a qual mês aquele snapshot pertence de fato.
Ao processar um mês-alvo, abra a planilha e CONFIRME que o Status Date cai
dentro do mês desejado antes de usar os números dela. Se não bater, procure
a pasta "Executiva" adjacente (mês anterior ou seguinte) até achar o Status
Date certo.

SEJA METÓDICO NISSO: não assuma que a data da pasta corresponde ao mês certo
em nenhuma hipótese. Para cada planilha aberta, confira o Status Date antes
de usar qualquer outro dado dela. Se, ao processar vários meses seguidos,
você perceber um padrão (ex: "a pasta Executiva do início do mês X sempre
reporta o fechamento do mês X-1"), pode usar esse padrão para ir direto à
pasta certa nos meses seguintes — mas sempre CONFIRME abrindo pelo menos uma
planilha de cada mês antes de confiar no padrão.

-------------------------------------------------------------------------------
4. MAPEAMENTO DE CAMPOS (planilha .xlsm → webapp)
-------------------------------------------------------------------------------
Cada arquivo RSE tem várias abas. As relevantes e o que extrair de cada uma:

CONFIANÇA ALTA (confirmado num arquivo de exemplo real):
  Aba "GERAL STATUS":
    - "Temperatura" (bloco de KPIs, topo direito) → trafficTag
      (Green→"Verde", Yellow→"Amarelo", Red→"Vermelho")
    - "Finance" (mesmo bloco de KPIs) → sinaliza saúde financeira (correlato
      de trafficTag, mas específico de finanças — útil para conferência)
    - "Revenue (CTR + CR)" → budgetPlanned (orçado, contrato + change requests)
    - "Forecast Margin" × 100 → marginPercent (margem REAL/atual, a mais
      importante para o dashboard — normalmente bem diferente da margem
      planejada quando o projeto está estourando custo)
    - "NPS" (valor e data no bloco de KPIs) → npsScore e npsDate
    - "SAP Cloud ALM" ("Not" = não usa) → usesCloudAlm (true/false)
    - "CR" no bloco de KPIs ("Not" = sem CR aberta) → hasOpenCr (true/false).
      Se houver um valor/CR aberta, procure o valor e descrição da CR nesta
      mesma aba ou na aba "RISKS" — NÃO CONFIRMADO num exemplo com CR aberta,
      valide isso na primeira migração real.
    - "SPI" (Schedule Performance Index) → derive scheduleDelayPercent como
      (1 - SPI) × 100. Ex: SPI 0,90 → 10% de atraso.
    - " Project:" (linha abaixo) → nome do projeto (ex: "RISE | Digital
      Finance") → use para compor "name"
    - "Project/Portfolio Manager:" → projectManager

  Aba "BILLING":
    - Bloco "TOTAL VALUE", coluna "Total" → confirma budgetPlanned (deve
      bater com "Revenue (CTR+CR)" da aba GERAL STATUS)
    - Bloco "INVOICE STATUS", coluna "Effective Value" → billed (total já
      faturado ao cliente até a data de status)
    - Tabela de linhas de faturamento (a partir da linha ~25, colunas
      "Effective Billing Date" e "Effective Invoice Value") → some os valores
      cujo "Effective Billing Date" caia DENTRO do mês-alvo para obter o
      faturamento DAQUELE MÊS especificamente (não o acumulado) — é isso que
      alimenta o histórico mensal (ver seção 6).

CONFIANÇA MÉDIA (existe no arquivo, mas requer mais cálculo/julgamento):
  Aba "GERAL STATUS":
    - "Total Cost (EAC)" e "Actual Cost (ETC)" → candidatos a budgetRealized
      (custo real incorrido). ATENÇÃO: no arquivo de exemplo o valor de
      "Actual Cost (ETC)" era MAIOR que "Total Cost (EAC)", o que é incomum
      (EAC deveria ser a projeção total, normalmente ≥ custo já incorrido).
      Use "Actual Cost (ETC)" como budgetRealized por padrão, mas AVISE o
      usuário dessa inconsistência na primeira migração para confirmar qual
      célula é realmente "quanto já foi gasto".
    - costVariancePercent: calcule como no restante do app:
      ((budgetRealized - budgetPlanned) / budgetPlanned) × 100

  Aba "QUALITY GATE":
    - Tem 5 blocos de documentos (Prepare, Explore, Realize, Deploy, Run),
      cada um com uma coluna "Concluido" (Sim/Não/N/A) por documento.
    - signedDocumentsPercent = (nº de "Sim") / (nº de "Sim" + nº de "Não"),
      ignorando linhas "N/A", somando todos os 5 blocos.
    - qaStatus: sugestão de regra (ajuste se fizer mais sentido outra):
      signedDocumentsPercent ≥ 90% → "Auditado"
      signedDocumentsPercent entre 60% e 90% → "Em Revisão"
      signedDocumentsPercent < 60% → "Pendente"

  Aba "PROJECT DATA":
    - "Schedule - Project End" → plannedEndDate
    - Datas de fase (Deploy, Wave, etc.) → contexto para "notes" se relevante

NÃO CONFIRMADO (não havia exemplo positivo no arquivo de teste):
  - crValue, crOpenDate, crDescription (o exemplo não tinha CR aberta)
  - pendenciesCount (não há um campo explícito de "contagem de pendências"
    claramente identificável na planilha)

REGRA GERAL PARA CAMPOS AUSENTES: se um campo do webapp não tiver uma célula
clara e correspondente na planilha RSE, NÃO invente um valor e não deixe de
migrar o projeto por causa disso — simplesmente deixe esse campo em branco/
zerado e prossiga. Esses campos ficam para o PMO preencher manualmente
depois, em Configurações:
  - Projetos > editar o projeto → campos de CR (valor, data, descrição) e
    "Pendências (nº)" já têm um campo próprio ali, com aviso de que não vêm
    da planilha RSE.
  - Histórico Mensal → tela dedicada para adicionar/corrigir o faturamento e
    a margem média de qualquer mês manualmente (útil também se uma migração
    automática errar algum número).

CAMPOS DERIVADOS DO CONTEXTO (não vêm de uma célula específica):
  - id, code: gere de forma estável a partir de cliente + solução
  - client, solution: do nome do arquivo (ver seção 2)
  - sharePointFolder: o link/caminho completo do arquivo de origem
  - referenceDate: o Status Date real extraído (seção 3)
  - status: "ATIVO" por padrão, a menos que o projeto esteja claramente
    encerrado (ex: fase = encerramento, sem próximas datas)

-------------------------------------------------------------------------------
5. OPÇÃO A — MIGRAÇÃO COMPLETA DO HISTÓRICO DE 2026
-------------------------------------------------------------------------------
Use esta opção quando o usuário pedir para trazer TODOS os meses já
disponíveis em "2.Portfolio_2026" de uma vez.

Passo 1. Liste as subpastas de "2.Portfolio_2026" (uma por mês, na ordem
  cronológica: Janeiro, Fevereiro, Março...).

Passo 2. Para cada mês, na ordem:
  a) Encontre a(s) pasta(s) "...- Executiva" dentro do mês (e, se precisar
     confirmar o Status Date, também dê uma olhada na primeira "Executiva"
     do mês seguinte — ver seção 3).
  b) Abra "Dashboard - GROW + DSC" e "Dashboard - RISE + FSW".
  c) Para cada arquivo cujo nome contenha "RSE" (seção 2), abra e extraia os
     campos da seção 4. Confirme o Status Date antes de aceitar os dados
     como pertencentes a esse mês.
  d) Monte, para esse mês:
     - revenueBilled = soma do faturamento DAQUELE MÊS (linhas de billing
       com Effective Billing Date dentro do mês) de TODOS os projetos RSE
       encontrados nesse mês.
     - marginAvg = média simples do "Forecast Margin" (×100) de todos os
       projetos RSE encontrados nesse mês.
  e) Envie esse mês para o histórico agregado (POST /api/vmo/state, campo
     "monthlyHistory") ANTES de passar para o próximo mês — acrescente ao
     array existente, não sobrescreva os meses já enviados. Formato de cada
     item: { monthKey: "2026-01", year: 2026, month: 1, revenueBilled: <nº>,
     marginAvg: <nº> }.

Passo 3. Depois de processar TODOS os meses disponíveis, pegue os dados
  completos e detalhados (todos os campos da seção 4, por projeto) apenas
  do ÚLTIMO mês processado (o mais recente) e envie para popular a lista
  "projects" (POST /api/vmo/state ou /api/vmo/projects) — é isso que aparece
  no dashboard de projetos individuais. Os meses anteriores ficam
  representados apenas pelos agregados no histórico (monthlyHistory), não
  pelo detalhe por projeto — essa é uma decisão deliberada do usuário.

Passo 4. Ao final, confirme com o usuário: quantos meses foram processados,
  quantos projetos RSE foram encontrados por mês, e quaisquer
  inconsistências encontradas (Status Date que não bateu com a pasta,
  campos "NÃO CONFIRMADO" da seção 4, nomes de solução que não mapearam).

-------------------------------------------------------------------------------
6. OPÇÃO B — ATUALIZAR APENAS O MÊS ATUAL
-------------------------------------------------------------------------------
Use esta opção para a rotina normal (mensal ou sob pedido), sem reprocessar
o histórico inteiro.

Passo 1. Determine o mês de referência: normalmente o mês corrente, a menos
  que o usuário peça outro. Consulte "referencePeriod" no estado atual do
  webapp (GET /api/vmo/state) se precisar confirmar a data considerada
  "atual" pelo app.

Passo 2. Encontre a pasta "...- Executiva" correta para esse mês (seção 1)
  e confirme o Status Date (seção 3) — pode ser necessário olhar a pasta do
  mês seguinte se a revisão daquele mês só é publicada no início do mês
  posterior.

Passo 3. Abra "Dashboard - GROW + DSC" e "Dashboard - RISE + FSW", processe
  todo arquivo com "RSE" no nome (seção 2), extraia os campos (seção 4).

Passo 4. Envie:
  a) A lista completa desses projetos para "projects" (substitui a lista
     atual — POST /api/vmo/state com o array completo de projetos deste mês).
  b) UM item de histórico para o mês atual em "monthlyHistory" — mesmo neste
     modo "só mês atual", sempre atualize (ou adicione, se ainda não existir)
     a entrada do mês corrente no histórico, para os gráficos comparativos
     continuarem corretos. Se já existir uma entrada para esse monthKey,
     SUBSTITUA os valores (não duplique).

Passo 5. Confirme com o usuário quantos projetos foram atualizados e
  qualquer inconsistência encontrada.

-------------------------------------------------------------------------------
7. COMO ESCREVER NO WEBAPP (referência rápida da API)
-------------------------------------------------------------------------------
Base: a URL do deploy do webapp + os caminhos abaixo. Todas as escritas
exigem o cabeçalho "x-api-key: <chave configurada em EXED_API_KEY>".

  GET  /api/vmo/state          → lê tudo (projetos, histórico, layout, etc.)
  POST /api/vmo/state          → atualiza parcialmente; envie só os campos
                                  que está alterando, ex:
                                  { "projects": [...], "monthlyHistory": [...] }
  POST /api/vmo/projects       → alternativa focada só em projetos

Sempre faça um GET primeiro para ver o estado atual (especialmente
"monthlyHistory") antes de decidir se deve ACRESCENTAR ou SUBSTITUIR uma
entrada de mês, para não perder dados já migrados.

-------------------------------------------------------------------------------
AVISO GERAL
-------------------------------------------------------------------------------
A estrutura interna das planilhas RSE (nomes de aba, layout de cada aba) é a
mesma em todos os projetos — o mapeamento da seção 4 vale para qualquer
arquivo RSE, não só para o exemplo usado para escrevê-lo. Ainda assim, esta é
a primeira migração real planejada para este webapp, então alguns detalhes
podem exigir ajuste na prática (ex: uma planilha específica com uma célula
fora do lugar, ou um mês com estrutura de pastas diferente — nesse caso, siga
a orientação adaptativa da seção 1). Quando um campo genuinamente não existir
na planilha, deixe-o em branco (seção 4) em vez de inventar — o PMO completa
depois pelas telas de edição de Projetos e de Histórico Mensal em
Configurações. Só pare e pergunte ao usuário se algo impedir a migração por
completo (ex: não conseguir acessar a pasta, ou um arquivo RSE corrompido).`;

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'vmo_server_state.json');
const SUPABASE_TABLE = 'vmo_app_state';
const SUPABASE_ROW_ID = 'singleton';

function buildDefaultState(): ServerVmoState {
  return {
    instrucoesPreenchimento: DEFAULT_INSTRUCOES_PREENCHIMENTO,
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
        return {
          ...stored,
          pageLayout: Array.isArray(stored.pageLayout) && stored.pageLayout.length > 0
            ? stored.pageLayout
            : INITIAL_PAGE_LAYOUT,
          containerLayout: Array.isArray(stored.containerLayout) && stored.containerLayout.length > 0
            ? stored.containerLayout
            : INITIAL_CONTAINER_LAYOUT,
          monthlyHistory: Array.isArray(stored.monthlyHistory) ? stored.monthlyHistory : INITIAL_MONTHLY_HISTORY
        };
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

  return readStateFromDisk() || buildDefaultState();
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
