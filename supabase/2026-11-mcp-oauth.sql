-- OAuth 2.1 para el MCP remoto (clientes, consentimientos, códigos y tokens).
-- Solo añade objetos; no borra ni modifica filas existentes.
-- NO aplicar en producción hasta el despliegue de esta fase.
-- Rollback: supabase/2026-11-mcp-oauth-rollback.sql

create table if not exists public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  client_secret_hash text,
  client_name text not null default '',
  redirect_uris text[] not null,
  token_endpoint_auth_method text not null default 'none',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint oauth_clients_client_id_unique unique (client_id)
);

create table if not exists public.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  client_name text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists oauth_grants_user_id_idx on public.oauth_grants (user_id);

create table if not exists public.oauth_pending_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  state text,
  resource text,
  scope text not null default 'garra',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists oauth_pending_consents_user_id_idx on public.oauth_pending_consents (user_id);

create table if not exists public.oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  client_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  grant_id uuid references public.oauth_grants (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  resource text,
  scope text not null default 'garra',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint oauth_authorization_codes_code_hash_unique unique (code_hash)
);

create table if not exists public.oauth_access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  grant_id uuid not null references public.oauth_grants (id) on delete cascade,
  client_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null default 'garra',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint oauth_access_tokens_token_hash_unique unique (token_hash)
);

create index if not exists oauth_access_tokens_user_id_idx on public.oauth_access_tokens (user_id);

create table if not exists public.oauth_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  grant_id uuid not null references public.oauth_grants (id) on delete cascade,
  client_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null default 'garra',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint oauth_refresh_tokens_token_hash_unique unique (token_hash)
);

alter table public.oauth_clients enable row level security;
alter table public.oauth_clients force row level security;
alter table public.oauth_grants enable row level security;
alter table public.oauth_grants force row level security;
alter table public.oauth_pending_consents enable row level security;
alter table public.oauth_pending_consents force row level security;
alter table public.oauth_authorization_codes enable row level security;
alter table public.oauth_authorization_codes force row level security;
alter table public.oauth_access_tokens enable row level security;
alter table public.oauth_access_tokens force row level security;
alter table public.oauth_refresh_tokens enable row level security;
alter table public.oauth_refresh_tokens force row level security;

revoke all on public.oauth_clients, public.oauth_pending_consents, public.oauth_authorization_codes, public.oauth_access_tokens, public.oauth_refresh_tokens
  from anon, authenticated;

revoke all on public.oauth_grants from anon, authenticated;
grant select (id, user_id, client_id, client_name, created_at, last_used_at, revoked_at)
  on public.oauth_grants to authenticated;

create policy oauth_grants_select_own
  on public.oauth_grants
  for select
  to authenticated
  using (auth.uid() = user_id);
