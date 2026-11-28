-- Rollback aditivo de la importación MCP. No toca movimientos ni saldos existentes.

drop function if exists public.import_mcp_from_token(uuid, text, timestamptz);
drop table if exists public.mcp_import_tokens;
