-- Tokens personales para el MCP remoto.
-- Solo crea la tabla nueva, sus índices y el RLS. No toca tablas ni filas existentes.
-- Rollback: supabase/2026-11-mcp-rollback.sql

create table if not exists public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,
  name text not null default 'MCP',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint mcp_tokens_token_hash_unique unique (token_hash)
);

create index if not exists mcp_tokens_user_id_idx on public.mcp_tokens (user_id);

alter table public.mcp_tokens enable row level security;
alter table public.mcp_tokens force row level security;

revoke all on public.mcp_tokens from anon, authenticated;
grant select (id, user_id, name, created_at, last_used_at, revoked_at)
  on public.mcp_tokens to authenticated;

create policy mcp_tokens_select_own
  on public.mcp_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);
