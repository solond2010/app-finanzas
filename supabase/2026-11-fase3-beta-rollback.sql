-- Marcha atrás de 2026-11-fase3-beta.sql (borra comentarios y errores guardados).
begin;
drop table if exists public.feedback;
drop table if exists public.app_errors;
drop function if exists public.feedback_rate_limit();
drop function if exists public.app_errors_guard();
drop function if exists public.is_garra_admin();
drop table if exists public.app_admins;
commit;
