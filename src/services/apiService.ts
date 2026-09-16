import { AppStateData } from '../types';

// ==============================================================================
// CHAVE DA API NO FRONTEND
// ==============================================================================
// Este arquivo vai inteiro para o bundle servido ao navegador. Qualquer literal
// aqui é PÚBLICO — basta abrir o DevTools para lê-lo.
//
// Antes havia a chave de produção escrita nesta linha, o que a publicava para
// qualquer visitante do site. Agora o padrão é vazio: o PMO cola a própria
// chave em Configurações > API do Claude e ela fica só no localStorage daquele
// navegador. Leituras do próprio dashboard (GET de mesma origem) não precisam
// de chave; só escrita precisa.
export const DEFAULT_EXED_API_KEY = '';

/**
 * Retorna a chave de API que este navegador tem guardada.
 * String vazia significa "nenhuma chave configurada" — a escrita vai falhar com
 * 401, e é isso mesmo que deve acontecer.
 */
export function getStoredApiKey(): string {
  try {
    const saved = localStorage.getItem('vmo_exed_claude_api_key');
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return DEFAULT_EXED_API_KEY;
}

/** true quando este navegador tem chave guardada. */
export function hasStoredApiKey(): boolean {
  return getStoredApiKey().length > 0;
}

/**
 * Salva uma nova chave de API no localStorage
 */
export function setStoredApiKey(key: string): void {
  try {
    localStorage.setItem('vmo_exed_claude_api_key', key.trim());
  } catch {}
}

/**
 * Busca o estado completo atualizado no servidor (que pode ter sido alterado pelo Claude)
 */
export async function fetchVmoServerState(): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const apiKey = getStoredApiKey();
    const res = await fetch('/api/vmo/state', {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.mensagem || `Erro HTTP ${res.status}: ${res.statusText}`
      };
    }

    const json = await res.json();
    return {
      success: true,
      data: json
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Falha de conexão com o servidor'
    };
  }
}

/**
 * Sincroniza o estado do webapp com o servidor.
 * - Envia o cabeçalho x-vmo-client: webapp (o servidor registra a origem certa).
 * - Com baseLastSaved, o servidor recusa (409) se os dados mudaram depois que a
 *   tela carregou; nesse caso a tela deve recarregar do servidor.
 */
export async function syncVmoServerState(
  state: Partial<AppStateData>,
  opcoes: { baseLastSaved?: string | null } = {}
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  conflict?: boolean;
  lastSaved?: string;
  avisos?: string[];
  clientesCadastrados?: string[];
}> {
  try {
    const apiKey = getStoredApiKey();
    const corpo = opcoes.baseLastSaved ? { ...state, baseLastSaved: opcoes.baseLastSaved } : state;
    const res = await fetch('/api/vmo/state', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'x-vmo-client': 'webapp',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(corpo)
    });

    if (res.status === 409) {
      const conflito = await res.json().catch(() => ({}));
      return {
        success: false,
        conflict: true,
        error: conflito.mensagem || 'Os dados do servidor mudaram.',
        lastSaved: conflito.ultima_atualizacao
      };
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.mensagem || errJson.detalhes || `Erro HTTP ${res.status}`
      };
    }

    const json = await res.json();
    return {
      success: true,
      message: json.mensagem,
      lastSaved: json.ultima_atualizacao,
      avisos: json.avisos,
      clientesCadastrados: json.clientes_cadastrados
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Falha de conexão com o servidor'
    };
  }
}

/**
 * Testa a conexão e autenticação com o endpoint do Claude
 */
export async function testClaudeApiConnection(keyToTest?: string): Promise<{
  success: boolean;
  statusText: string;
  details?: any;
}> {
  try {
    const key = keyToTest || getStoredApiKey();
    const res = await fetch('/api/vmo/state', {
      headers: {
        'x-api-key': key,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        statusText: 'Conexão autorizada com sucesso! O Claude tem acesso de leitura e escrita a todo o webapp.',
        details: {
          instrucoes: data.INSTRUCOES_PARA_PREENCHIMENTO,
          localDosDados: data.LOCAL_DOS_DADOS,
          totalProjetos: data.resumo_executivo?.total_projetos ?? data.projects?.length
        }
      };
    } else {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        statusText: err.mensagem || `Falha na autenticação (HTTP ${res.status})`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      statusText: `Erro ao conectar: ${err?.message || 'Servidor inacessível'}`
    };
  }
}
