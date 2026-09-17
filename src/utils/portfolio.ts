// ==============================================================================
// FRENTES × SOLUÇÕES
// ==============================================================================
// Solução: tipo de oferta SAP do projeto. Na RSE vem de PROJECT DATA →
//   "Project Portfolio". São sempre 6, com chaves fixas; só o nome exibido muda.
// Frente: unidade de gestão chefiada por um gerente de portfólio. Na RSE,
//   PROJECT DATA → "Portfolio Manager" indica o responsável. São sempre 6.
// A divisão por frente é POR PROJETO: projetos da mesma solução podem estar em
// frentes diferentes (os projetos GROW do Felipe Beni ficam em FÁBRICA e os do
// Alexandre Ferreira em RISE). A frente segue o NOME do gerente de portfólio.
// A solução nunca decide a frente.
// Os projetos guardam as CHAVES. Os nomes vêm do catálogo configurado pelo PMO
// (Configurações > Gestão de projetos SAP > Frentes e soluções), então renomear
// não quebra dados, filtros nem histórico.
import type { CatalogoPortfolio, FrenteConfig, FrontType, SolutionType } from '../types';

export const SOLUCOES_KEYS: SolutionType[] = ['RISE', 'GROW', 'SCE', 'SCP', 'FSW', 'DSC'];
export const FRENTES_KEYS: FrontType[] = ['RISE', 'GROW', 'IBP', 'SUPPLY_CHAIN', 'FABRICA', 'FSW'];

// Responsáveis corrigidos pelo usuário em 17/09/2026: a tabela de 15-17/09
// juntava Guto Leite, Felipe Beni e Samuel Angarani na mesma frente (FÁBRICA)
// por engano. Agora cada um tem a sua própria frente. Editável pelo PMO.
export const DEFAULT_CATALOGO_PORTFOLIO: CatalogoPortfolio = {
  solucoes: [
    { key: 'RISE', label: 'RISE' },
    { key: 'GROW', label: 'GROW' },
    { key: 'SCE', label: 'SCE' },
    { key: 'SCP', label: 'SCP' },
    { key: 'FSW', label: 'FSW' },
    { key: 'DSC', label: 'DSC' }
  ],
  frentes: [
    { key: 'RISE', label: 'RISE', responsaveis: ['Alexandre Ferreira'] },
    { key: 'GROW', label: 'GROW', responsaveis: [] },
    { key: 'IBP', label: 'IBP', responsaveis: ['Zorday Cavalcanti'] },
    { key: 'SUPPLY_CHAIN', label: 'SUPPLY CHAIN', responsaveis: ['Guto Leite'] },
    { key: 'FABRICA', label: 'FÁBRICA', responsaveis: ['Felipe Beni'] },
    { key: 'FSW', label: 'FWS', responsaveis: ['Samuel Angarani'] }
  ]
};

function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function chaveTexto(valor: unknown): string {
  return semAcento(String(valor ?? ''))
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, ' ');
}

function nomePessoa(valor: unknown): string {
  return semAcento(String(valor ?? ''))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Valores da RSE e de versões antigas do app ("SCP (IBP)", "Fábrica").
const SINONIMOS_SOLUCAO: Record<string, SolutionType> = {
  'RISE': 'RISE',
  'RISE WITH SAP': 'RISE',
  'GROW': 'GROW',
  'GROW WITH SAP': 'GROW',
  'SCE': 'SCE',
  'SCP': 'SCP',
  'SCP (IBP)': 'SCP',
  'IBP': 'SCP',
  'FSW': 'FSW',
  'FABRICA': 'FSW',
  'FABRICA DE SOFTWARE': 'FSW',
  'DSC': 'DSC',
  'DIGITAL SUPPLY CHAIN': 'DSC'
};

const SINONIMOS_FRENTE: Record<string, FrontType> = {
  'RISE': 'RISE',
  'GROW': 'GROW',
  'IBP': 'IBP',
  'SUPPLY CHAIN': 'SUPPLY_CHAIN',
  'SUPPLYCHAIN': 'SUPPLY_CHAIN',
  'FABRICA': 'FABRICA',
  'FSW': 'FSW',
  'FWS': 'FSW',
  'FABRICA DE SOFTWARE': 'FSW'
};

/** Chave da solução a partir de um valor da RSE, de versão antiga ou de um nome do catálogo. */
export function normalizarSolucao(valor: unknown, catalogo?: CatalogoPortfolio): SolutionType | null {
  const k = chaveTexto(valor);
  if (!k) return null;
  const porNome = catalogo?.solucoes.find(s => chaveTexto(s.label) === k);
  return SINONIMOS_SOLUCAO[k] ?? (porNome ? porNome.key : null);
}

/** Chave da frente a partir da chave, de um sinônimo ou de um nome do catálogo. */
export function normalizarFrente(valor: unknown, catalogo?: CatalogoPortfolio): FrontType | null {
  const k = chaveTexto(valor);
  if (!k) return null;
  const porNome = catalogo?.frentes.find(f => chaveTexto(f.label) === k);
  return SINONIMOS_FRENTE[k] ?? (porNome ? porNome.key : null);
}

/**
 * Garante exatamente 6 soluções e 6 frentes, nas chaves fixas e nessa ordem,
 * preservando nomes e responsáveis válidos da entrada.
 */
export function normalizarCatalogo(entrada?: Partial<CatalogoPortfolio> | null): CatalogoPortfolio {
  const base = DEFAULT_CATALOGO_PORTFOLIO;
  const solucoes = SOLUCOES_KEYS.map(key => {
    const padrao = base.solucoes.find(s => s.key === key)!;
    const achada = Array.isArray(entrada?.solucoes) ? entrada!.solucoes!.find(s => s && s.key === key) : undefined;
    const label = String(achada?.label ?? '').trim();
    return { key, label: label || padrao.label };
  });
  const frentes: FrenteConfig[] = FRENTES_KEYS.map(key => {
    const padrao = base.frentes.find(f => f.key === key)!;
    const achada = Array.isArray(entrada?.frentes) ? entrada!.frentes!.find(f => f && f.key === key) : undefined;
    if (!achada) return { key, label: padrao.label, responsaveis: [...padrao.responsaveis] };
    const label = String(achada.label ?? '').trim();
    return {
      key,
      label: label || padrao.label,
      responsaveis: Array.isArray(achada.responsaveis)
        ? achada.responsaveis.map(r => String(r).trim()).filter(Boolean)
        : [...padrao.responsaveis]
    };
  });
  return { solucoes, frentes };
}

export function rotuloSolucao(catalogo: CatalogoPortfolio, valor?: string | null): string {
  if (!valor) return '—';
  const key = normalizarSolucao(valor, catalogo);
  return (key && catalogo.solucoes.find(s => s.key === key)?.label) || String(valor);
}

export function rotuloFrente(catalogo: CatalogoPortfolio, valor?: string | null): string {
  if (!valor) return '—';
  const key = normalizarFrente(valor, catalogo);
  return (key && catalogo.frentes.find(f => f.key === key)?.label) || String(valor);
}

export interface ResultadoFrente {
  frente: FrontType | null;
  aviso: string | null;
}

/**
 * Frente de um projeto NOVO pela regra do responsável: a frente cujo
 * responsável é o gerente de portfólio da RSE. Sem frente ou com mais de uma,
 * o projeto fica sem frente até o PMO definir. Projeto já existente mantém a
 * frente gravada (tratado por quem chama).
 */
export function definirFrente(catalogo: CatalogoPortfolio, gerentePortfolio?: string | null): ResultadoFrente {
  const gestor = nomePessoa(gerentePortfolio);
  if (!gestor) {
    return { frente: null, aviso: 'sem gerente de portfólio na RSE; defina a frente na lista de projetos.' };
  }
  const doGestor = catalogo.frentes.filter(f => f.responsaveis.some(r => nomePessoa(r) === gestor));
  if (doGestor.length === 1) return { frente: doGestor[0].key, aviso: null };
  if (doGestor.length > 1) {
    return {
      frente: null,
      aviso: `${gerentePortfolio} é responsável por mais de uma frente (${doGestor.map(f => f.label).join(', ')}); defina a frente na lista de projetos.`
    };
  }
  return {
    frente: null,
    aviso: `${gerentePortfolio} não é responsável por nenhuma frente; defina a frente na lista de projetos ou inclua o gestor em Frentes e soluções.`
  };
}

/** Frente gravada no projeto ou, na falta dela, a do responsável. */
export function frenteEfetiva(
  p: { front?: string | null; portfolioManager?: string | null },
  catalogo: CatalogoPortfolio
): FrontType | null {
  return normalizarFrente(p.front, catalogo) ?? definirFrente(catalogo, p.portfolioManager).frente;
}

// ------------------------------------------------------------------- filtros
// Cada item do filtro é uma frente ("fr:CHAVE") ou uma solução ("sol:CHAVE").
// Itens do mesmo grupo somam (OU); frentes e soluções se cruzam (E).
export type FiltroPortfolio = 'TODOS' | `sol:${SolutionType}` | `fr:${FrontType}`;

export const filtroSolucao = (key: SolutionType): FiltroPortfolio => `sol:${key}`;
export const filtroFrente = (key: FrontType): FiltroPortfolio => `fr:${key}`;

export function filtrarProjetosPorPortfolio<
  T extends { solution?: string | null; front?: string | null; portfolioManager?: string | null }
>(projetos: T[], filtros: readonly string[], catalogo: CatalogoPortfolio): T[] {
  if (filtros.length === 0 || filtros.includes('TODOS')) return projetos;
  const solucoes = filtros.filter(f => f.startsWith('sol:')).map(f => f.slice(4));
  const frentes = filtros.filter(f => f.startsWith('fr:')).map(f => f.slice(3));
  return projetos.filter(p => {
    const okSolucao = solucoes.length === 0 || solucoes.includes(normalizarSolucao(p.solution, catalogo) ?? '');
    const okFrente = frentes.length === 0 || frentes.includes(frenteEfetiva(p, catalogo) ?? '');
    return okSolucao && okFrente;
  });
}

export function rotuloFiltro(catalogo: CatalogoPortfolio, filtro: string): string {
  if (filtro === 'TODOS') return 'Todos';
  if (filtro.startsWith('sol:')) return rotuloSolucao(catalogo, filtro.slice(4));
  if (filtro.startsWith('fr:')) return rotuloFrente(catalogo, filtro.slice(3));
  return filtro;
}

// Catálogo em uso fora dos componentes React (exportações em PDF, PPT e Excel).
let catalogoAtual: CatalogoPortfolio = DEFAULT_CATALOGO_PORTFOLIO;

export function definirCatalogoAtual(catalogo: CatalogoPortfolio): void {
  catalogoAtual = catalogo;
}

export function catalogoEmUso(): CatalogoPortfolio {
  return catalogoAtual;
}
