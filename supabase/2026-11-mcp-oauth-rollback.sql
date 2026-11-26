-- Rollback de supabase/2026-11-mcp-oauth.sql. No aplica hasta el despliegue.

drop table if exists public.oauth_refresh_tokens;
drop table if exists public.oauth_access_tokens;
drop table if exists public.oauth_authorization_codes;
drop table if exists public.oauth_pending_consents;
drop table if exists public.oauth_grants;
drop table if exists public.oauth_clients;
