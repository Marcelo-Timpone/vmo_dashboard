-- =============================================================================
-- EXED CONSULTING — VMO CORPORATIVO
-- SCHEMA DO SUPABASE — versão idempotente (pode rodar mais de uma vez)
--
-- COMO USAR: Supabase > SQL Editor > New query > cole tudo > Run.
--
-- O QUE MUDOU EM RELAÇÃO A supabase/schema.sql:
--   1. `current_date` agora vem entre aspas. CURRENT_DATE é palavra reservada
--      no PostgreSQL e não pode ser nome de coluna sem aspas — o script antigo
--      provavelmente falhava com erro de sintaxe nessa linha. As aspas não
--      mudam o nome da coluna, então o front-end continua funcionando igual.
--   2. As políticas agora têm DROP POLICY IF EXISTS antes do CREATE. CREATE
--      POLICY não tem forma IF NOT EXISTS, então rodar o script antigo duas
--      vezes dava erro de política duplicada.
--   3. Acrescentei a tabela opcional `vmo_migracao_arquivos`, usada para
--      auditar a carga histórica vinda das planilhas de RSE.
--
-- Nenhuma tabela é apagada e nenhum dado existente é sobrescrito.
-- =============================================================================


-- =============================================================================
-- PARTE 1 — TABELA CRÍTICA
-- =============================================================================
-- Esta é a única tabela realmente indispensável. Guarda, em uma linha só
-- (id = 'singleton'), todo o estado que /api/vmo/state e /api/mcp leem e
-- escrevem: projetos, clientes, widgets, links, período de referência, tema,
-- instruções e o histórico mensal.
--
-- Sem ela configurada (junto com SUPABASE_SERVICE_ROLE_KEY), o saveState cai
-- no fallback de disco — que na Vercel é efêmero e some no próximo deploy.
-- É por isso que a migração precisa dela antes de começar.

CREATE TABLE IF NOT EXISTS public.vmo_app_state (
    id          TEXT PRIMARY KEY,
    state_json  JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vmo_app_state ENABLE ROW LEVEL SECURITY;
-- Sem política pública de propósito: só a Service Role Key acessa (ela ignora
-- RLS). O navegador nunca toca nesta tabela diretamente.


-- =============================================================================
-- PARTE 2 — AUTENTICAÇÃO DE USUÁRIOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vmo_auth_users (
    id             TEXT PRIMARY KEY,
    username       TEXT UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    name           TEXT NOT NULL,
    role           TEXT NOT NULL CHECK (role IN ('pmo', 'demonstrativo')),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vmo_auth_users ENABLE ROW LEVEL SECURITY;
-- Também sem política pública: só a Service Role Key.

-- Contas iniciais. TROQUE AS SENHAS NO PRIMEIRO LOGIN.
--   pmo@exedconsulting.com            -> ExedVmo@2026!
--   demonstrativo@exedconsulting.com  -> Demonstrativo@2026
INSERT INTO public.vmo_auth_users (id, username, password_hash, name, role)
VALUES
  ('usr-pmo-default',  'pmo@exedconsulting.com',
   '$2b$10$TbHpb7zUF8f0hRYK9NC49OyrxCMDoMHIqD/.dx3vGURTh1xkQYZpW',
   'Gestor VMO / PMO Corporativo', 'pmo'),
  ('usr-demo-default', 'demonstrativo@exedconsulting.com',
   '$2b$10$dgL1uN1WTk01WrAZ1ENxBepf1stvXDETpbmMYXH3aS/oN9EZCOGdy',
   'Visualizador Executivo', 'demonstrativo')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- PARTE 3 — TABELAS DE SINCRONIZAÇÃO DO FRONT-END
-- =============================================================================
-- Usadas por src/services/supabaseService.ts. Acessadas pelo navegador com a
-- anon key, por isso têm políticas abertas.

CREATE TABLE IF NOT EXISTS public.usuarios (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL CHECK (role IN ('pmo', 'demonstrativo')),
    name        TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.configuracao_graficos (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    type        TEXT NOT NULL,
    order_num   INTEGER NOT NULL,
    visible     BOOLEAN NOT NULL DEFAULT TRUE,
    collapsed   BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.links (
    id          TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    url         TEXT NOT NULL,
    is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
    notes       TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ATENÇÃO à coluna "current_date": as aspas são obrigatórias.
CREATE TABLE IF NOT EXISTS public.data_referencia (
    id              TEXT PRIMARY KEY,
    start_date      TEXT NOT NULL,
    end_date        TEXT NOT NULL,
    period_label    TEXT NOT NULL,
    "current_date"  TEXT NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projetos_sap (
    id              TEXT PRIMARY KEY,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    client          TEXT NOT NULL,
    client_logo     TEXT,
    solution        TEXT NOT NULL,
    project_manager TEXT,
    budget_planned  NUMERIC DEFAULT 0,
    budget_realized NUMERIC DEFAULT 0,
    variance        NUMERIC DEFAULT 0,
    margin_percent  NUMERIC DEFAULT 0,
    billed          NUMERIC DEFAULT 0,
    qa_status       TEXT DEFAULT 'Auditado',
    csat_score      NUMERIC DEFAULT 9.0,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_graficos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_referencia       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_sap          ENABLE ROW LEVEL SECURITY;

-- Políticas abertas (o front usa a anon key). DROP antes do CREATE porque
-- CREATE POLICY não aceita IF NOT EXISTS.
DROP POLICY IF EXISTS "Permitir leitura usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir escrita usuarios" ON public.usuarios;
CREATE POLICY "Permitir leitura usuarios" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Permitir escrita usuarios" ON public.usuarios FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir leitura graficos" ON public.configuracao_graficos;
DROP POLICY IF EXISTS "Permitir escrita graficos" ON public.configuracao_graficos;
CREATE POLICY "Permitir leitura graficos" ON public.configuracao_graficos FOR SELECT USING (true);
CREATE POLICY "Permitir escrita graficos" ON public.configuracao_graficos FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir leitura links" ON public.links;
DROP POLICY IF EXISTS "Permitir escrita links" ON public.links;
CREATE POLICY "Permitir leitura links" ON public.links FOR SELECT USING (true);
CREATE POLICY "Permitir escrita links" ON public.links FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir leitura data_referencia" ON public.data_referencia;
DROP POLICY IF EXISTS "Permitir escrita data_referencia" ON public.data_referencia;
CREATE POLICY "Permitir leitura data_referencia" ON public.data_referencia FOR SELECT USING (true);
CREATE POLICY "Permitir escrita data_referencia" ON public.data_referencia FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir leitura projetos" ON public.projetos_sap;
DROP POLICY IF EXISTS "Permitir escrita projetos" ON public.projetos_sap;
CREATE POLICY "Permitir leitura projetos" ON public.projetos_sap FOR SELECT USING (true);
CREATE POLICY "Permitir escrita projetos" ON public.projetos_sap FOR ALL USING (true);

INSERT INTO public.usuarios (id, username, role, name)
VALUES
    ('usr-pmo',  'PMO@exedconsulting.com',           'pmo',            'Administrador PMO'),
    ('usr-demo', 'demonstrativo@exedconsulting.com', 'demonstrativo',  'Visitante Executivo')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- PARTE 4 — AUDITORIA DA MIGRAÇÃO (opcional, mas recomendada)
-- =============================================================================
-- Nenhum código do app lê esta tabela. Ela existe para a carga histórica das
-- planilhas de RSE: registra qual arquivo do Drive já foi processado, para
-- qual projeto, e com que resultado.
--
-- Sem ela, não há como responder "esse arquivo já entrou?" nem repetir a
-- migração em lotes sem duplicar dados.

CREATE TABLE IF NOT EXISTS public.vmo_migracao_arquivos (
    drive_file_id  TEXT PRIMARY KEY,
    nome_arquivo   TEXT NOT NULL,
    semana         DATE NOT NULL,
    codigo_exed    TEXT,          -- Project ID (S4 Public Exed), a chave estável
    portfolio      TEXT,
    cliente        TEXT,
    status         TEXT NOT NULL DEFAULT 'ok',   -- ok | erro | ignorado
    observacao     TEXT,
    lido_em        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migracao_semana
    ON public.vmo_migracao_arquivos (semana);
CREATE INDEX IF NOT EXISTS idx_migracao_codigo
    ON public.vmo_migracao_arquivos (codigo_exed);

ALTER TABLE public.vmo_migracao_arquivos ENABLE ROW LEVEL SECURITY;
-- Sem política pública: só a Service Role Key.


-- =============================================================================
-- PARTE 5 — CONFERÊNCIA
-- =============================================================================
-- Rode este SELECT depois. Devem aparecer 8 linhas.

SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'vmo_app_state', 'vmo_auth_users', 'vmo_migracao_arquivos',
      'usuarios', 'configuracao_graficos', 'links',
      'data_referencia', 'projetos_sap'
  )
ORDER BY tablename;


-- =============================================================================
-- DEPOIS DE RODAR: VARIÁVEIS DE AMBIENTE NA VERCEL
-- =============================================================================
-- Settings > Environment Variables. Sem estas, o banco fica órfão e o app
-- continua salvando em disco efêmero.
--
--   SUPABASE_URL               Project Settings > API > Project URL
--   SUPABASE_SERVICE_ROLE_KEY  Project Settings > API > service_role (secret)
--   VITE_SUPABASE_URL          mesma URL acima (usada pelo front)
--   VITE_SUPABASE_ANON_KEY     Project Settings > API > anon public
--   EXED_API_KEY               sua chave da API (troque a atual)
--   AUTH_JWT_SECRET            openssl rand -hex 32
--
-- SUPABASE_SERVICE_ROLE_KEY e AUTH_JWT_SECRET nunca levam prefixo VITE_ —
-- esse prefixo faz o Vite embutir o valor no bundle do navegador.
-- =============================================================================
