// ==============================================================================
// FRENTES × SOLUÇÕES
// ==============================================================================
// Solução: tipo de oferta SAP do projeto. Na RSE vem de PROJECT DATA →
//   "Project Portfolio". São sempre 6, com chaves fixas; só o nome exibido muda.
// Frente: unidade de gestão chefiada por um ou mais gerentes de portfólio. Na
//   RSE, PROJECT DATA → "Portfolio Manager" indica o responsável. São sempre 5.
//   Uma frente pode reunir mais de uma solução, e uma solução pode aparecer em
//   mais de uma frente: quem desempata é o gerente de portfólio.
// Os projetos guardam as CHAVES. Os nomes vêm do catálogo configurado pelo PMO
// (Configurações > Gestão de projetos SAP > Frentes e soluções), então renomear
// não quebra dados, filtros nem histórico.
import type { CatalogoPortfolio, FrenteConfig, FrontType, SolutionType } from '../types';

export const SOLUCOES_KEYS: SolutionType[] = ['RISE', 'GROW', 'SCE', 'SCP', 'FSW', 'DSC'];
export const FRENTES_KEYS: FrontType[] = ['RISE', 'GROW', 'IBP', 'SUPPLY_CHAIN', 'FABRICA'];

// Regra informada pelo usuário em 15–16/09/2026. Editável pelo PMO.
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
    { key: 'RISE', label: 'RISE', responsaveis: ['Alexandre Ferreira'], solucoes: ['RISE'] },
    { key: 'GROW', label: 'GROW', responsaveis: ['Alexandre Ferreira'], solucoes: ['GROW'] },
    { key: 'IBP', label: 'IBP', responsaveis: ['Zorday Cavalcanti'], solucoes: ['SCP'] },
    { key: 'SUPPLY_CHAIN', label: 'SUPPLY CHAIN', responsaveis: ['Zorday Cavalcanti'], solucoes: ['SCE', 'DSC'] },
    { key: 'FABRICA', label: 'FÁBRICA', responsaveis: ['Guto Leite'], solucoes: ['FSW', 'SCE'] }
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
  'FABRICA DE SOFTWARE': 'FABRICA'
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
 * Garante exatamente 6 soluções e 5 frentes, nas chaves fixas e nessa ordem,
 * preservando nomes, responsáveis e soluções válidos da entrada.
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
    if (!achada) return { ...padrao, responsaveis: [...padrao.responsaveis], solucoes: [...padrao.solucoes] };
    const label = String(achada.label ?? '').trim();
    return {
      key,
      label: label || padrao.label,
      responsaveis: Array.isArray(achada.responsaveis)
        ? achada.responsaveis.map(r => String(r).trim()).filter(Boolean)
        : [...padrao.responsaveis],
      solucoes: Array.isArray(achada.solucoes)
        ? SOLUCOES_KEYS.filter(s => achada.solucoes.includes(s))
        : [...padrao.solucoes]
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
 * Regra de classificação: a frente é a do gerente de portfólio responsável.
 * Se ele responde por mais de uma frente, a solução do projeto desempata.
 * Se ele não está no catálogo, vale a única frente que atende a solução.
 */
export function definirFrente(
  catalogo: CatalogoPortfolio,
  gerentePortfolio?: string | null,
  solucao?: string | null
): ResultadoFrente {
  const sol = normalizarSolucao(solucao, catalogo);
  const nomeSol = sol ? rotuloSolucao(catalogo, sol) : 'vazia';
  const gestor = nomePessoa(gerentePortfolio);
  const doGestor = gestor ? catalogo.frentes.filter(f => f.responsaveis.some(r => nomePessoa(r) === gestor)) : [];

  if (doGestor.length === 1) {
    const f = doGestor[0];
    const aviso = sol && !f.solucoes.includes(sol) ? `a solução ${nomeSol} não está entre as soluções da frente ${f.label}.` : null;
    return { frente: f.key, aviso };
  }
  if (doGestor.length > 1) {
    const comSolucao = doGestor.filter(f => sol !== null && f.solucoes.includes(sol));
    if (comSolucao.length === 1) return { frente: comSolucao[0].key, aviso: null };
    return {
      frente: null,
      aviso: `${gerentePortfolio} responde por ${doGestor.map(f => f.label).join(' e ')}, e a solução ${nomeSol} não decide qual.`
    };
  }
  const porSolucao = catalogo.frentes.filter(f => sol !== null && f.solucoes.includes(sol));
  if (porSolucao.length === 1) {
    return {
      frente: porSolucao[0].key,
      aviso: gerentePortfolio
        ? `${gerentePortfolio} não é responsável por nenhuma frente; frente definida pela solução ${nomeSol}.`
        : `sem gerente de portfólio; frente definida pela solução ${nomeSol}.`
    };
  }
  return {
    frente: null,
    aviso: `não foi possível definir a frente (gerente de portfólio ${gerentePortfolio || 'vazio'}, solução ${nomeSol}).`
  };
}

/** Frente gravada no projeto ou, na falta dela, a calculada pela regra. */
export function frenteEfetiva(
  p: { front?: string | null; portfolioManager?: string | null; solution?: string | null },
  catalogo: CatalogoPortfolio
): FrontType | null {
  return normalizarFrente(p.front, catalogo) ?? definirFrente(catalogo, p.portfolioManager, p.solution).frente;
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
