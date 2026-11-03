-- Comentarios desde la demo (visitantes sin cuenta).
-- Los visitantes de la demo no tienen usuario: su comentario se guarda con
-- user_id vacío mediante una función con límite global (máx. 30 por hora).
-- Rollback: supabase/2026-11-feedback-demo-rollback.sql

alter table public.feedback alter column user_id drop not null;

create or replace function public.submit_demo_feedback(p_kind text, p_message text, p_page text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if (select count(*) from public.feedback f where f.user_id is null and f.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Demasiados comentarios seguidos. Prueba dentro de un rato.' using errcode = 'P0001';
  end if;
  insert into public.feedback (user_id, kind, message, page, email, user_agent)
  values (null, p_kind, p_message, left(p_page, 300), 'Visitante de la demo', left(p_user_agent, 300));
end;
$$;

revoke all on function public.submit_demo_feedback(text, text, text, text) from public;
grant execute on function public.submit_demo_feedback(text, text, text, text) to anon, authenticated, service_role;
