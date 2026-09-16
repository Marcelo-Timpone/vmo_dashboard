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
import {
  DEFAULT_CATALOGO_PORTFOLIO,
  SOLUCOES_KEYS,
  definirFrente,
  normalizarCatalogo,
  normalizarFrente,
  normalizarSolucao
} from '../src/utils/portfolio.js';
import { INSTRUCOES_PADRAO_V2, INSTRUCOES_PADRAO_V3 } from './instrucoesPadrao.js';
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
  MonthlyKpiSnapshot,
  ProjetoSemAtualizacao,
  CatalogoPortfolio,
  SolutionType
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
  /** Projetos cujo GP não atualizou a RSE no mês (ver ProjetoSemAtualizacao). */
  projetosSemAtualizacao: ProjetoSemAtualizacao[];
  /** Frentes × soluções: nomes, responsáveis e soluções de cada frente (src/utils/portfolio.ts). */
  catalogoPortfolio: CatalogoPortfolio;
  instrucoesPreenchimentoBackup?: string;
  lastSaved: string;
  updatedBy?: string;
  /**
   * Carimbo igual a lastSaved em toda gravação feita por esta versão do
   * servidor. O gatilho do banco (vmo_protege_estado) só deixa alterar os dados
   * quando os dois batem — versões antigas do app ficam impedidas de
   * sobrescrever projetos, clientes, histórico e instruções.
   */
  escritaVerificadaEm?: string;
  /** Transitório: autoriza gravar listas vazias nesta gravação. Nunca persiste. */
  limpezaConfirmada?: boolean;
}

export interface ResultadoAplicacao {
  avisos: string[];
  ignorados: string[];
  clientesCadastrados: string[];
}

export interface ResultadoGravacao {
  /** Chaves que o banco recusou alterar (o valor gravado ficou diferente do enviado). */
  bloqueios: string[];
}

export const SOLUCOES_VALIDAS: SolutionType[] = SOLUCOES_KEYS;

/** Normaliza nome de cliente para comparação: sem acento, caixa, pontuação e sufixo societário. */
export function normalizarNomeCliente(nome: string): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?\s?\/?a\.?|ltda\.?|inc\.?|na)\s*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slug(texto: string): string {
  return normalizarNomeCliente(texto).replace(/\s+/g, '-');
}

/**
 * Regra do usuário: toda migração cadastra os clientes que ainda não existem.
 * Roda sempre que projetos ou projetos sem atualização são gravados.
 * Devolve os nomes cadastrados agora.
 */
export function garantirClientesCadastrados(state: ServerVmoState): string[] {
  const clientes = Array.isArray(state.clients) ? [...state.clients] : [];
  const conhecidos = new Set<string>();
  clientes.forEach(c => {
    conhecidos.add(normalizarNomeCliente(c.name));
    if (c.shortName) conhecidos.add(normalizarNomeCliente(c.shortName));
  });
  const cadastrados: string[] = [];
  const candidatos: { client?: string; solution?: string; status?: string }[] = [
    ...(state.projects || []),
    ...(state.projetosSemAtualizacao || [])
  ];
  candidatos.forEach(p => {
    const nome = (p.client || '').trim();
    if (!nome) return;
    const chave = normalizarNomeCliente(nome);
    if (!chave || conhecidos.has(chave)) return;
    conhecidos.add(chave);
    const solucao = normalizarSolucao(p.solution, state.catalogoPortfolio) ?? undefined;
    clientes.push({
      id: 'cli-' + slug(nome),
      name: nome,
      shortName: nome,
      logoUrl: '',
      status: 'ATIVO',
      ...(solucao ? { defaultSolution: solucao } : {}),
      notes: 'Cadastrado automaticamente na migração das RSE.'
    });
    cadastrados.push(nome);
  });
  if (cadastrados.length > 0) state.clients = clientes;
  return cadastrados;
}

/**
 * Converte solução e frente de cada projeto para as chaves do catálogo e
 * calcula a frente pelo gerente de portfólio quando ela não vier. Altera os
 * objetos recebidos e devolve avisos (não bloqueia a gravação).
 */
export function normalizarProjetosRecebidos(projetos: any[], catalogo: CatalogoPortfolio): string[] {
  const avisos: string[] = [];
  projetos.forEach((p: any) => {
    if (!p || typeof p !== 'object') return;
    const nome = p.name || p.id || '(sem nome)';
    if (!p.projectIdS4 && !p.projectIdMissing) {
      avisos.push(`${nome}: sem projectIdS4. Preencha com o "Project ID (S4 Public Exed)" ou marque projectIdMissing: true.`);
    }
    if (p.solution !== undefined && p.solution !== null && p.solution !== '') {
      const sol = normalizarSolucao(p.solution, catalogo);
      if (sol) p.solution = sol;
      else avisos.push(`${nome}: solução "${p.solution}" não existe (use ${SOLUCOES_KEYS.join(', ')}).`);
    }
    const informada = normalizarFrente(p.front, catalogo);
    if (informada) {
      p.front = informada;
      return;
    }
    if (p.front) avisos.push(`${nome}: frente "${p.front}" não existe; recalculada pelo gerente de portfólio.`);
    const regra = definirFrente(catalogo, p.portfolioManager, p.solution);
    if (regra.frente) p.front = regra.frente;
    else delete p.front;
    if (regra.aviso) avisos.push(`${nome}: ${regra.aviso}`);
  });
  return avisos;
}

function normalizarSemAtualizacao(lista: any[] | undefined, catalogo: CatalogoPortfolio): void {
  (lista || []).forEach((p: any) => {
    if (!p || typeof p !== 'object') return;
    const sol = normalizarSolucao(p.solution, catalogo);
    if (sol) p.solution = sol;
    const frente = normalizarFrente(p.front, catalogo) ?? definirFrente(catalogo, p.portfolioManager, p.solution).frente;
    if (frente) p.front = frente;
  });
}

export const DEFAULT_INSTRUCOES_PREENCHIMENTO = INSTRUCOES_PADRAO_V3;



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
export const INSTRUCOES_VERSAO_ATUAL = 3;

const META_RECEITA_DE_FABRICA = 120000000;

/**
 * Textos que sabidamente saíram de fábrica e podem ser substituídos sem perda.
 * Acrescente aqui a íntegra de qualquer padrão antigo que venha a existir —
 * nunca troque isto por uma heurística de palavras-chave.
 */
const PADROES_DE_FABRICA_CONHECIDOS: string[] = [
  INSTRUCOES_PADRAO_V2,
  INSTRUCOES_PADRAO_V3
];
const META_MARGEM_DE_FABRICA = 24;

function instrucoesSaoDeFabrica(texto: string): boolean {
  // Só reconhece texto VAZIO ou idêntico a um padrão de fábrica conhecido.
  //
  // A versão anterior desta função usava heurística ("não contém MIRROR ACTUAL
  // ⇒ é antigo"). Isso estava ERRADO e era destrutivo: a instalação em produção
  // tinha 17 mil caracteres de instruções escritas à mão, mais detalhadas que o
  // padrão, e a heurística as classificava como "de fábrica" — o primeiro
  // loadState() teria apagado todas.
  //
  // REGRA: na dúvida, PRESERVAR. Instrução escrita por gente vale mais que
  // padrão gerado. Se o texto não for reconhecido, ele fica como está e o
  // console avisa que existe uma versão nova disponível.
  if (!texto || !texto.trim()) return true;
  return PADROES_DE_FABRICA_CONHECIDOS.some(p => p.trim() === texto.trim());
}

function migrarEstadoCarregado(state: ServerVmoState): ServerVmoState {
  const versao = state.instrucoesVersao ?? 0;

  if (versao < INSTRUCOES_VERSAO_ATUAL) {
    if (instrucoesSaoDeFabrica(state.instrucoesPreenchimento)) {
      console.info('[vmoState] Instruções de fábrica substituídas pela versão ' + INSTRUCOES_VERSAO_ATUAL + '.');
      state.instrucoesPreenchimento = DEFAULT_INSTRUCOES_PREENCHIMENTO;
      state.instrucoesVersao = INSTRUCOES_VERSAO_ATUAL;
    } else {
      // Texto customizado: NÃO é tocado, e a versão NÃO é marcada como
      // atualizada — assim este aviso continua aparecendo até alguém decidir
      // conscientemente o que fazer.
      console.warn(
        '[vmoState] As instruções gravadas foram personalizadas e NÃO foram alteradas. ' +
          'Existe uma versão padrão mais nova disponível; revise e mescle manualmente em ' +
          'Configurações > Instruções, se fizer sentido.'
      );
    }
  }

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

  if (!Array.isArray(state.projetosSemAtualizacao)) state.projetosSemAtualizacao = [];
  // Frentes × soluções: catálogo sempre com 6 soluções e 5 frentes, e dados de
  // versões antigas ("SCP (IBP)", "Fábrica") convertidos para as chaves novas.
  state.catalogoPortfolio = normalizarCatalogo(state.catalogoPortfolio);
  delete (state as any).gestoresPorFrente;
  normalizarProjetosRecebidos(state.projects || [], state.catalogoPortfolio);
  normalizarSemAtualizacao(state.projetosSemAtualizacao, state.catalogoPortfolio);
  (state.clients || []).forEach(c => {
    if (!c.defaultSolution) return;
    const sol = normalizarSolucao(c.defaultSolution, state.catalogoPortfolio);
    if (sol) c.defaultSolution = sol;
    else delete c.defaultSolution;
  });

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
    // Estado inicial VAZIO. Antes nascia com os 15 projetos de demonstração
    // (Petrobras, Vale, Ambev...), que apareciam no relatório executivo como se
    // fossem clientes reais. Os dados reais entram pela migração das RSE.
    projects: [],
    clients: [],
    widgets: INITIAL_WIDGETS,
    sharePointLinks: INITIAL_SHAREPOINT_LINKS,
    containerSettings: DEFAULT_CONTAINER_SETTINGS,
    referencePeriod: calculateVmoReferencePeriod(new Date()),
    theme: 'neon',
    pageLayout: INITIAL_PAGE_LAYOUT,
    containerLayout: INITIAL_CONTAINER_LAYOUT,
    monthlyHistory: INITIAL_MONTHLY_HISTORY,
    projetosSemAtualizacao: [],
    catalogoPortfolio: DEFAULT_CATALOGO_PORTFOLIO,
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
    const { data, error } = await client!
      .from(SUPABASE_TABLE)
      .select('state_json')
      .eq('id', SUPABASE_ROW_ID)
      .maybeSingle();

    if (error) {
      // Antes, um erro aqui caía para o estado padrão (vazio) e a gravação
      // seguinte apagava os dados reais. Agora a operação é interrompida.
      throw new Error(
        'Não foi possível ler o estado no Supabase (' + error.message + '). ' +
          'Nada foi gravado, para não sobrescrever os dados reais.'
      );
    }

    if (data?.state_json) {
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
    }

    // Sem erro e sem linha: primeira execução de fato.
    const initial = buildDefaultState();
    await saveState(initial);
    return initial;
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
export function applyIncomingUpdates(state: ServerVmoState, body: any): ResultadoAplicacao {
  const resultado: ResultadoAplicacao = { avisos: [], ignorados: [], clientesCadastrados: [] };
  body = body || {};
  const confirmarLimpeza = body.confirmarLimpeza === true;
  if (confirmarLimpeza) state.limpezaConfirmada = true;
  // Lista vazia só substitui lista com conteúdo quando a limpeza é explícita.
  // Foi uma lista vazia enviada pelo webapp que apagou a migração no teste.
  const aceitaLista = (nome: string, nova: any[], atual: any[] | undefined): boolean => {
    if (nova.length > 0 || confirmarLimpeza || !Array.isArray(atual) || atual.length === 0) return true;
    resultado.ignorados.push(nome + ': lista vazia ignorada (envie confirmarLimpeza: true para apagar de propósito).');
    return false;
  };
  let precisaConferirClientes = false;

  // Catálogo de frentes × soluções primeiro: os projetos abaixo já usam o novo.
  const incomingCatalogo = body.catalogoPortfolio || body.catalogo_portfolio;
  if (incomingCatalogo && typeof incomingCatalogo === 'object') {
    state.catalogoPortfolio = normalizarCatalogo(incomingCatalogo);
  }
  const catalogo = normalizarCatalogo(state.catalogoPortfolio);
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
  if (Array.isArray(incomingProjects) && aceitaLista('projetos', incomingProjects, state.projects)) {
    state.projects = incomingProjects;
    resultado.avisos.push(...normalizarProjetosRecebidos(incomingProjects, catalogo));
    precisaConferirClientes = true;
  }

  // 4. Clientes
  const incomingClients = body.clients || body.clientes || body.dados?.clientes;
  if (Array.isArray(incomingClients) && aceitaLista('clientes', incomingClients, state.clients)) {
    state.clients = incomingClients;
    precisaConferirClientes = true;
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

  // 13. Projetos sem atualização do GP (mantidos pelo Claude)
  const incomingSemAtualizacao = body.projetosSemAtualizacao || body.projetos_sem_atualizacao;
  if (Array.isArray(incomingSemAtualizacao) && aceitaLista('projetosSemAtualizacao', incomingSemAtualizacao, state.projetosSemAtualizacao)) {
    normalizarSemAtualizacao(incomingSemAtualizacao, catalogo);
    state.projetosSemAtualizacao = incomingSemAtualizacao;
    precisaConferirClientes = true;
  }

  // 15. Versão e cópia de segurança das instruções
  if (typeof body.instrucoesVersao === 'number') state.instrucoesVersao = body.instrucoesVersao;
  if (typeof body.instrucoesPreenchimentoBackup === 'string') {
    state.instrucoesPreenchimentoBackup = body.instrucoesPreenchimentoBackup;
  }

  // 16. Regra: todo cliente citado em projeto precisa estar cadastrado.
  if (precisaConferirClientes) {
    resultado.clientesCadastrados = garantirClientesCadastrados(state);
  }

  return resultado;
}

/**
 * Serialização com chaves ordenadas. O Postgres (jsonb) reordena as chaves dos
 * objetos; sem isto, dados idênticos pareceriam diferentes na conferência.
 */
function jsonEstavel(valor: any): string {
  if (Array.isArray(valor)) return '[' + valor.map(v => jsonEstavel(v)).join(',') + ']';
  if (valor && typeof valor === 'object') {
    return (
      '{' +
      Object.keys(valor)
        .filter(k => valor[k] !== undefined)
        .sort()
        .map(k => JSON.stringify(k) + ':' + jsonEstavel(valor[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(valor === undefined ? null : valor);
}

const CHAVES_PROTEGIDAS = [
  'projects',
  'clients',
  'monthlyHistory',
  'projetosSemAtualizacao',
  'catalogoPortfolio',
  'instrucoesPreenchimento'
] as const;

export async function saveState(state: ServerVmoState): Promise<ResultadoGravacao> {
  state.lastSaved = new Date().toISOString();
  state.escritaVerificadaEm = state.lastSaved;

  if (isSupabaseAdminConfigured()) {
    const client = getSupabaseAdminClient();
    const { data, error } = await client!
      .from(SUPABASE_TABLE)
      .upsert({ id: SUPABASE_ROW_ID, state_json: state, updated_at: state.lastSaved })
      .select('state_json')
      .maybeSingle();
    delete state.limpezaConfirmada;

    // Antes o erro só virava aviso no log e a API respondia "sucesso".
    if (error) throw new Error('Falha ao gravar o estado no Supabase: ' + error.message);

    const bloqueios: string[] = [];
    const gravado = data?.state_json as any;
    if (gravado) {
      CHAVES_PROTEGIDAS.forEach(k => {
        if (jsonEstavel((state as any)[k]) !== jsonEstavel(gravado[k])) {
          bloqueios.push(k);
          (state as any)[k] = gravado[k];
        }
      });
    }
    return { bloqueios };
  }

  delete state.limpezaConfirmada;
  writeStateToDisk(state);
  return { bloqueios: [] };
}
