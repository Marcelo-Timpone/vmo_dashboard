import { AppStateData } from '../types';

export const DEFAULT_EXED_API_KEY = 'exed_claude_vmo_live_sec_key_2026';

/**
 * Retorna a chave de API configurada para o Claude (armazenada localmente ou a padrão)
 */
export function getStoredApiKey(): string {
  try {
    const saved = localStorage.getItem('vmo_exed_claude_api_key');
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return DEFAULT_EXED_API_KEY;
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
 * Sincroniza o estado atual do webapp para o servidor, para que o Claude veja os dados em tempo real
 */
export async function syncVmoServerState(state: Partial<AppStateData>): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const apiKey = getStoredApiKey();
    const res = await fetch('/api/vmo/state', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.mensagem || `Erro HTTP ${res.status}`
      };
    }

    const json = await res.json();
    return {
      success: true,
      message: json.mensagem
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
