-- Deshace supabase/2026-11-planes.sql
drop function if exists public.founder_count();
drop table if exists public.user_plans;
