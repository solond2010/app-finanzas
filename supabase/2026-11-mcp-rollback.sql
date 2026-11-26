-- Rollback de supabase/2026-11-mcp.sql. Solo elimina la tabla nueva.
-- No toca transactions, accounts ni ningún otro dato existente.

drop table if exists public.mcp_tokens;
