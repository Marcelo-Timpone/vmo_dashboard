import { handlePreflight, getApiKeyStatus } from '../../lib/apiAuth.js';
import { loadState } from '../../lib/vmoState.js';
import { isSupabaseAdminConfigured, getSupabaseAdminClient } from '../../lib/supabaseAdmin.js';

// ==============================================================================
// ROTA PÚBLICA DE DIAGNÓSTICO — /api/vmo/health
// ==============================================================================
// Não exige API key de propósito: serve justamente para descobrir por que a API
// key não está funcionando. Nunca devolve valores de credenciais, só se cada
// peça está configurada e o que fazer quando não está.
//
// Use esta rota ANTES de cadastrar o conector do Claude: se
// `pronto_para_o_claude` vier false, o conector também não vai funcionar, e
// `proximos_passos` diz exatamente o que falta.
// ==============================================================================
export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;

  const keyStatus = getApiKeyStatus();
  const supabaseConfigurado = isSupabaseAdminConfigured();

  // Teste real de leitura na tabela: "configurado" e "funcionando" são coisas
  // diferentes — a chave pode estar presente e o schema não ter sido aplicado.
  let supabaseAcessivel = false;
  let supabaseErro: string | undefined;
  if (supabaseConfigurado) {
    try {
      const client = getSupabaseAdminClient();
      const { error } = await client!
        .from('vmo_app_state')
        .select('id')
        .eq('id', 'singleton')
        .maybeSingle();
      if (error) {
        supabaseErro = error.message;
      } else {
        supabaseAcessivel = true;
      }
    } catch (err: any) {
      supabaseErro = err?.message || String(err);
    }
  }

  let totalProjetos: number | null = null;
  let mesesNoHistorico: number | null = null;
  let sharepointConfigurado = false;
  try {
    const state = await loadState();
    totalProjetos = state.projects.length;
    mesesNoHistorico = (state.monthlyHistory || []).length;
    sharepointConfigurado = !!state.localDosDados;
  } catch {
    // loadState só falha se nem o fallback local funcionar; os campos ficam null.
  }

  const host = String(req.headers?.['host'] ?? '');
  const protocolo = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  const baseUrl = host ? `${protocolo}://${host}` : '';

  const proximosPassos: string[] = [];
  if (!keyStatus.configurada) {
    proximosPassos.push(
      'Configure EXED_API_KEY em Vercel > Settings > Environment Variables e refaça o deploy.'
    );
  }
  if (!supabaseConfigurado) {
    proximosPassos.push(
      'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel. Sem elas o estado é gravado ' +
        'em disco efêmero e some no próximo deploy.'
    );
  } else if (!supabaseAcessivel) {
    proximosPassos.push(
      `Supabase configurado, mas a leitura da tabela vmo_app_state falhou (${supabaseErro}). ` +
        'Confirme que supabase/schema-vmo.sql foi executado no projeto correto.'
    );
  }

  const prontoParaOClaude = keyStatus.configurada && supabaseConfigurado && supabaseAcessivel;

  res.status(200).json({
    status: 'online',
    projeto: 'Exed Consulting - VMO Corporativo',
    versao_api: '1.1-claude-ready',
    timestamp: new Date().toISOString(),

    pronto_para_o_claude: prontoParaOClaude,

    autenticacao: {
      metodo: 'API Key (x-api-key, Authorization: Bearer, ou ?apiKey= na query)',
      chave_configurada: keyStatus.configurada,
      origem: 'variável de ambiente EXED_API_KEY',
      detalhe: keyStatus.motivo
    },

    persistencia: {
      supabase_configurado: supabaseConfigurado,
      supabase_acessivel: supabaseAcessivel,
      tabela: 'vmo_app_state',
      erro: supabaseErro,
      aviso: supabaseConfigurado
        ? undefined
        : 'Sem Supabase, o estado é gravado em disco efêmero e não sobrevive ao próximo deploy.'
    },

    endpoints: {
      estado: baseUrl ? `${baseUrl}/api/vmo/state` : '/api/vmo/state',
      mcp: baseUrl ? `${baseUrl}/api/mcp` : '/api/mcp',
      openapi: baseUrl ? `${baseUrl}/api/vmo/openapi.json` : '/api/vmo/openapi.json',
      health: baseUrl ? `${baseUrl}/api/vmo/health` : '/api/vmo/health'
    },

    dados: {
      projetos_cadastrados: totalProjetos,
      meses_no_historico: mesesNoHistorico,
      sharepoint_configurado: sharepointConfigurado
    },

    proximos_passos: proximosPassos.length > 0 ? proximosPassos : ['Nada pendente.']
  });
}
