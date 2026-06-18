-- =============================================================
--  Tabela de armazenamento do Painel Hotmart + ManyChat
--  Cole TUDO isto no Supabase: SQL Editor -> New query -> Run
-- =============================================================

create table if not exists app_state (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Segurança: ativa RLS sem políticas públicas.
-- O sistema acessa com a chave service_role (server-side), que ignora RLS.
-- Assim, a chave pública (anon) NÃO consegue ler nem escrever nada.
alter table app_state enable row level security;

-- Linha inicial vazia (o sistema preenche depois).
insert into app_state (key, value)
values ('hotmart_manychat_db', '{"products":[],"logs":[],"settings":{}}'::jsonb)
on conflict (key) do nothing;
