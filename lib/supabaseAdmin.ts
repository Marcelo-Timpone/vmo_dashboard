import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ==============================================================================
// CLIENTE SUPABASE PARA USO EXCLUSIVAMENTE NO SERVIDOR (Node / Vercel Functions)
// ==============================================================================
// IMPORTANTE: Este arquivo usa a SERVICE ROLE KEY do Supabase, que tem acesso
// total ao banco (ignora Row Level Security). Ela NUNCA deve ser exposta ao
// navegador. Por isso lemos apenas de process.env (nunca de import.meta.env
// e nunca com o prefixo VITE_, que o Vite injeta no bundle do cliente).

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminConfig(): { url: string; serviceKey: string } {
  // A URL do projeto não é sensível, então também aceitamos a variável
  // pública (VITE_SUPABASE_URL) caso SUPABASE_URL não tenha sido definida,
  // evitando que o usuário precise cadastrar a mesma URL duas vezes.
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, serviceKey };
}

export function isSupabaseAdminConfigured(): boolean {
  const { url, serviceKey } = getSupabaseAdminConfig();
  return Boolean(url && serviceKey);
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) return null;

  if (!cachedAdminClient) {
    const { url, serviceKey } = getSupabaseAdminConfig();
    cachedAdminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  return cachedAdminClient;
}
