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


-- =============================================================================
-- VERSÃO 3 (16/09/2026) — proteção do estado, auditoria e registro de IDs
-- Já aplicada no projeto vmo_dashboard (migração vmo_v3_protecao_estado_registro_ids).
-- =============================================================================
create table if not exists public.vmo_app_state_auditoria (
  id bigserial primary key,
  ocorrido_em timestamptz not null default now(),
  atualizado_por text,
  escrita_verificada boolean not null,
  bloqueios text[] not null default '{}',
  projetos_antes integer,
  projetos_depois integer,
  clientes_antes integer,
  clientes_depois integer,
  meses_antes integer,
  meses_depois integer
);
alter table public.vmo_app_state_auditoria enable row level security;

create or replace function public.vmo_tamanho_lista(j jsonb)
returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'array' then jsonb_array_length(j) else null end
$$;

-- a) Gravação sem carimbo (escritaVerificadaEm = lastSaved) vem de versão antiga
--    do app: projetos, clientes, histórico, catálogo e instruções não mudam.
-- b) Lista com conteúdo só vira lista vazia com limpezaConfirmada = true.
create or replace function public.vmo_protege_estado()
returns trigger language plpgsql set search_path = public as $$
declare
  verificada boolean := coalesce(new.state_json->>'escritaVerificadaEm', '') <> ''
                        and new.state_json->>'escritaVerificadaEm' = new.state_json->>'lastSaved';
  limpeza boolean := coalesce(new.state_json->>'limpezaConfirmada', '') = 'true';
  chave text;
  bloqueios text[] := '{}';
  protegidas text[] := array['projects','clients','monthlyHistory','projetosSemAtualizacao','catalogoPortfolio','instrucoesPreenchimento','instrucoesVersao','instrucoesPreenchimentoBackup'];
  listas text[] := array['projects','clients','monthlyHistory','projetosSemAtualizacao'];
begin
  if not verificada then
    foreach chave in array protegidas loop
      if (old.state_json -> chave) is distinct from (new.state_json -> chave) then
        if old.state_json ? chave then
          new.state_json := jsonb_set(new.state_json, array[chave], old.state_json -> chave, true);
        else
          new.state_json := new.state_json - chave;
        end if;
        bloqueios := bloqueios || ('versao_antiga:' || chave);
      end if;
    end loop;
  elsif not limpeza then
    foreach chave in array listas loop
      if coalesce(public.vmo_tamanho_lista(old.state_json -> chave), 0) > 0
         and coalesce(public.vmo_tamanho_lista(new.state_json -> chave), 0) = 0 then
        new.state_json := jsonb_set(new.state_json, array[chave], old.state_json -> chave, true);
        bloqueios := bloqueios || ('lista_vazia:' || chave);
      end if;
    end loop;
  end if;
  new.state_json := new.state_json - 'limpezaConfirmada';
  insert into public.vmo_app_state_auditoria (
    atualizado_por, escrita_verificada, bloqueios,
    projetos_antes, projetos_depois, clientes_antes, clientes_depois, meses_antes, meses_depois
  ) values (
    new.state_json->>'updatedBy', verificada, bloqueios,
    public.vmo_tamanho_lista(old.state_json->'projects'), public.vmo_tamanho_lista(new.state_json->'projects'),
    public.vmo_tamanho_lista(old.state_json->'clients'), public.vmo_tamanho_lista(new.state_json->'clients'),
    public.vmo_tamanho_lista(old.state_json->'monthlyHistory'), public.vmo_tamanho_lista(new.state_json->'monthlyHistory')
  );
  return new;
end
$$;

drop trigger if exists trg_vmo_protege_estado on public.vmo_app_state;
create trigger trg_vmo_protege_estado
  before update on public.vmo_app_state
  for each row execute function public.vmo_protege_estado();

-- Registro de projetos pelo Project ID (S4 Public Exed); frente e solução nas chaves fixas.
create table if not exists public.vmo_projetos_ids (
  chave text primary key,
  project_id_s4 text unique,
  id_ausente boolean not null default false,
  nome text,
  cliente text,
  frente text check (frente is null or frente in ('RISE','GROW','IBP','SUPPLY_CHAIN','FABRICA')),
  solucao text check (solucao is null or solucao in ('RISE','GROW','SCE','SCP','FSW','DSC')),
  gerente_projeto text,
  gerente_portfolio text,
  situacao text check (situacao in ('ativo','encerrado','sem_atualizacao','fora_do_escopo')),
  ultima_semana date,
  ultimo_status_date date,
  arquivo_origem text,
  observacao text,
  atualizado_em timestamptz not null default now()
);
alter table public.vmo_projetos_ids enable row level security;

alter table public.vmo_migracao_arquivos add column if not exists project_id_s4 text;
alter table public.vmo_migracao_arquivos add column if not exists id_ausente boolean not null default false;

-- =============================================================================
-- VERSÃO 3.2 (17/09/2026) — backup completo, restauração e limpeza total
-- Já aplicada no projeto vmo_dashboard (migração vmo_v31_backup_restauracao_limpeza).
-- Chamadas só pelo servidor (service_role), via /api/vmo/backup.
-- =============================================================================
create or replace function public.vmo_resumo_dados()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'projetos', coalesce((select public.vmo_tamanho_lista(s.state_json->'projects') from public.vmo_app_state s where s.id = 'singleton'), 0),
    'clientes', coalesce((select public.vmo_tamanho_lista(s.state_json->'clients') from public.vmo_app_state s where s.id = 'singleton'), 0),
    'meses_historico', coalesce((select public.vmo_tamanho_lista(s.state_json->'monthlyHistory') from public.vmo_app_state s where s.id = 'singleton'), 0),
    'projetos_sem_atualizacao', coalesce((select public.vmo_tamanho_lista(s.state_json->'projetosSemAtualizacao') from public.vmo_app_state s where s.id = 'singleton'), 0),
    'registro_ids', (select count(*) from public.vmo_projetos_ids),
    'arquivos_migrados', (select count(*) from public.vmo_migracao_arquivos),
    'ultima_atualizacao', (select s.state_json->>'lastSaved' from public.vmo_app_state s where s.id = 'singleton')
  )
$$;

create or replace function public.vmo_backup_completo()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'formato', 'vmo-backup',
    'versao', 2,
    'gerado_em', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'estado', coalesce((select s.state_json - 'limpezaConfirmada' from public.vmo_app_state s where s.id = 'singleton'), '{}'::jsonb),
    'tabelas', jsonb_build_object(
      'vmo_projetos_ids', coalesce((select jsonb_agg(to_jsonb(p) order by p.chave) from public.vmo_projetos_ids p), '[]'::jsonb),
      'vmo_migracao_arquivos', coalesce((select jsonb_agg(to_jsonb(m) order by m.semana, m.drive_file_id) from public.vmo_migracao_arquivos m), '[]'::jsonb)
    ),
    'resumo', public.vmo_resumo_dados()
  )
$$;

create or replace function public.vmo_apagar_dados(p_carimbo text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_carimbo, '') = '' then
    raise exception 'Carimbo de gravação obrigatório.';
  end if;
  update public.vmo_app_state
  set state_json = state_json || jsonb_build_object(
        'projects', '[]'::jsonb, 'clients', '[]'::jsonb, 'monthlyHistory', '[]'::jsonb,
        'projetosSemAtualizacao', '[]'::jsonb, 'limpezaConfirmada', true,
        'updatedBy', 'usuario-webapp-apagar-tudo', 'lastSaved', p_carimbo, 'escritaVerificadaEm', p_carimbo),
      updated_at = now()
  where id = 'singleton';
  delete from public.vmo_projetos_ids where true;
  delete from public.vmo_migracao_arquivos where true;
  return public.vmo_resumo_dados();
end
$$;

create or replace function public.vmo_restaurar_backup(p_backup jsonb, p_carimbo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_estado jsonb := p_backup -> 'estado';
begin
  if coalesce(p_carimbo, '') = '' then
    raise exception 'Carimbo de gravação obrigatório.';
  end if;
  if coalesce(p_backup ->> 'formato', '') <> 'vmo-backup' or jsonb_typeof(v_estado) is distinct from 'object' then
    raise exception 'Arquivo não é um backup completo do VMO (formato vmo-backup).';
  end if;
  update public.vmo_app_state
  set state_json = (v_estado - 'limpezaConfirmada' - 'escritaVerificadaEm') || jsonb_build_object(
        'limpezaConfirmada', true, 'updatedBy', 'usuario-webapp-restaurar-backup',
        'lastSaved', p_carimbo, 'escritaVerificadaEm', p_carimbo),
      updated_at = now()
  where id = 'singleton';
  if not found then
    insert into public.vmo_app_state (id, state_json, updated_at)
    values ('singleton', (v_estado - 'limpezaConfirmada') || jsonb_build_object(
      'updatedBy', 'usuario-webapp-restaurar-backup', 'lastSaved', p_carimbo, 'escritaVerificadaEm', p_carimbo), now());
  end if;
  if jsonb_typeof(p_backup -> 'tabelas') = 'object' then
    delete from public.vmo_projetos_ids where true;
    insert into public.vmo_projetos_ids (chave, project_id_s4, id_ausente, nome, cliente, frente, solucao, gerente_projeto,
      gerente_portfolio, situacao, ultima_semana, ultimo_status_date, arquivo_origem, observacao, atualizado_em)
    select r.chave, r.project_id_s4, coalesce(r.id_ausente, false), r.nome, r.cliente, r.frente, r.solucao, r.gerente_projeto,
      r.gerente_portfolio, r.situacao, r.ultima_semana, r.ultimo_status_date, r.arquivo_origem, r.observacao, coalesce(r.atualizado_em, now())
    from jsonb_populate_recordset(null::public.vmo_projetos_ids, coalesce(p_backup -> 'tabelas' -> 'vmo_projetos_ids', '[]'::jsonb)) r;
    delete from public.vmo_migracao_arquivos where true;
    insert into public.vmo_migracao_arquivos (drive_file_id, nome_arquivo, semana, codigo_exed, portfolio, cliente, status,
      observacao, lido_em, project_id_s4, id_ausente)
    select r.drive_file_id, r.nome_arquivo, r.semana, r.codigo_exed, r.portfolio, r.cliente, coalesce(r.status, 'ok'),
      r.observacao, r.lido_em, r.project_id_s4, coalesce(r.id_ausente, false)
    from jsonb_populate_recordset(null::public.vmo_migracao_arquivos, coalesce(p_backup -> 'tabelas' -> 'vmo_migracao_arquivos', '[]'::jsonb)) r;
  end if;
  return public.vmo_resumo_dados();
end
$$;

revoke all on function public.vmo_resumo_dados() from public, anon, authenticated;
revoke all on function public.vmo_backup_completo() from public, anon, authenticated;
revoke all on function public.vmo_apagar_dados(text) from public, anon, authenticated;
revoke all on function public.vmo_restaurar_backup(jsonb, text) from public, anon, authenticated;
grant execute on function public.vmo_resumo_dados() to service_role;
grant execute on function public.vmo_backup_completo() to service_role;
grant execute on function public.vmo_apagar_dados(text) to service_role;
grant execute on function public.vmo_restaurar_backup(jsonb, text) to service_role;
