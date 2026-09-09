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

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_graficos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_referencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_sap ENABLE ROW LEVEL SECURITY;

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
