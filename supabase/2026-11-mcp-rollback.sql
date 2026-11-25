-- Rollback de supabase/2026-11-mcp.sql. No aplica en la fase 1.

drop trigger if exists trg_reconcile_account_saldo_on_account on public.accounts;
drop trigger if exists trg_reconcile_account_saldo_from_transaction on public.transactions;
drop function if exists public.tg_reconcile_account_saldo_on_account();
drop function if exists public.tg_reconcile_account_saldo_from_transaction();
drop function if exists public.reconcile_account_saldo(text, uuid);
drop table if exists public.mcp_tokens;
