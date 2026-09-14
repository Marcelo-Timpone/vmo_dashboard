-- ==============================================================================
-- EXED CONSULTING - VMO CORPORATIVO
-- ESQUEMA DO BANCO DE DADOS SUPABASE (4 TABELAS PRINCIPAIS)
-- Copie e cole este script no Editor SQL do seu projeto Supabase e clique em "Run".
-- ==============================================================================

-- 1. Tabela de Usuários e Perfis de Acesso
CREATE TABLE IF NOT EXISTS public.usuarios (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('pmo', 'demonstrativo')),
    name TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Configuração e Ordem dos Gráficos / Indicadores
CREATE TABLE IF NOT EXISTS public.configuracao_graficos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    order_num INTEGER NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    collapsed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Links de Pastas SharePoint
CREATE TABLE IF NOT EXISTS public.links (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Data de Referência Contábil do VMO
CREATE TABLE IF NOT EXISTS public.data_referencia (
    id TEXT PRIMARY KEY,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    period_label TEXT NOT NULL,
    current_date TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela Opcional de Projetos SAP (para persistência completa em nuvem)
CREATE TABLE IF NOT EXISTS public.projetos_sap (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    client TEXT NOT NULL,
    client_logo TEXT,
    solution TEXT NOT NULL,
    project_manager TEXT,
    budget_planned NUMERIC DEFAULT 0,
    budget_realized NUMERIC DEFAULT 0,
    variance NUMERIC DEFAULT 0,
    margin_percent NUMERIC DEFAULT 0,
    billed NUMERIC DEFAULT 0,
    qa_status TEXT DEFAULT 'Auditado',
    csat_score NUMERIC DEFAULT 9.0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Estado Completo do WebApp para a API do Claude
-- Guarda em uma única linha (id = 'singleton') todo o estado que a API
-- /api/vmo/state lê e escreve: projetos, clientes, widgets, links, período de
-- referência, tema e instruções. É acessada apenas pelo backend (Vercel
-- Serverless Functions) usando a SERVICE ROLE KEY, nunca pelo navegador —
-- por isso NÃO recebe políticas públicas de leitura/escrita como as tabelas
-- acima.
CREATE TABLE IF NOT EXISTS public.vmo_app_state (
    id TEXT PRIMARY KEY,
    state_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela de Autenticação Real de Usuários (login + gestão pelo PMO)
-- Guarda usuário, hash de senha (bcrypt) e papel (pmo/demonstrativo).
-- Acessada apenas pelo backend via Service Role Key — nunca pelo navegador —
-- por isso NÃO recebe políticas públicas, igual à vmo_app_state.
-- IMPORTANTE: não confundir com a tabela `usuarios` acima, que é só um
-- diretório usado pela sincronização do front-end e não guarda senha.
CREATE TABLE IF NOT EXISTS public.vmo_auth_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('pmo', 'demonstrativo')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vmo_auth_users ENABLE ROW LEVEL SECURITY;
-- Nenhuma política pública de propósito — só a Service Role Key acessa.

-- Habilitar Row Level Security (RLS) nas demais tabelas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_graficos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_referencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_sap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vmo_app_state ENABLE ROW LEVEL SECURITY;
-- Nenhuma política pública é criada para vmo_app_state de propósito: só a
-- Service Role Key (usada no servidor) pode acessá-la, pois ela ignora RLS.

-- Contas iniciais (TROQUE AS SENHAS ASSIM QUE FIZER O PRIMEIRO LOGIN):
--   usuário: pmo@exedconsulting.com           | senha: ExedVmo@2026!
--   usuário: demonstrativo@exedconsulting.com | senha: Demonstrativo@2026
INSERT INTO public.vmo_auth_users (id, username, password_hash, name, role)
VALUES
  ('usr-pmo-default', 'pmo@exedconsulting.com', '$2b$10$TbHpb7zUF8f0hRYK9NC49OyrxCMDoMHIqD/.dx3vGURTh1xkQYZpW', 'Gestor VMO / PMO Corporativo', 'pmo'),
  ('usr-demo-default', 'demonstrativo@exedconsulting.com', '$2b$10$dgL1uN1WTk01WrAZ1ENxBepf1stvXDETpbmMYXH3aS/oN9EZCOGdy', 'Visualizador Executivo', 'demonstrativo')
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso (Permitir leitura pública e escrita autenticada/anônima com anonKey)
CREATE POLICY "Permitir leitura usuarios" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Permitir escrita usuarios" ON public.usuarios FOR ALL USING (true);

CREATE POLICY "Permitir leitura graficos" ON public.configuracao_graficos FOR SELECT USING (true);
CREATE POLICY "Permitir escrita graficos" ON public.configuracao_graficos FOR ALL USING (true);

CREATE POLICY "Permitir leitura links" ON public.links FOR SELECT USING (true);
CREATE POLICY "Permitir escrita links" ON public.links FOR ALL USING (true);

CREATE POLICY "Permitir leitura data_referencia" ON public.data_referencia FOR SELECT USING (true);
CREATE POLICY "Permitir escrita data_referencia" ON public.data_referencia FOR ALL USING (true);

CREATE POLICY "Permitir leitura projetos" ON public.projetos_sap FOR SELECT USING (true);
CREATE POLICY "Permitir escrita projetos" ON public.projetos_sap FOR ALL USING (true);

-- Dados iniciais padrão de usuários
INSERT INTO public.usuarios (id, username, role, name)
VALUES 
    ('usr-pmo', 'PMO@exedconsulting.com', 'pmo', 'Administrador PMO'),
    ('usr-demo', 'demonstrativo@exedconsulting.com', 'demonstrativo', 'Visitante Executivo')
ON CONFLICT (id) DO NOTHING;
