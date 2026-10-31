-- =====================================================================
-- FASE 3 · Beta — comentarios de usuarios y registro de errores
-- =====================================================================
-- Qué hace (todo en UNA transacción):
--   1. app_admins + is_garra_admin(): quién puede leer comentarios y errores
--      (solo Moha). La tabla no tiene políticas: nadie la lee ni la cambia
--      desde la app; se gestiona desde el SQL Editor.
--   2. feedback: «Enviar comentario». Cada usuario conectado solo puede
--      INSERTAR filas suyas; solo un admin puede leerlas o marcarlas.
--      Tope: 10 comentarios por usuario y hora (trigger).
--   3. app_errors: errores de la app (navegador y servidor). Solo INSERT
--      para clientes; solo un admin lee. Sin datos financieros: ruta,
--      mensaje, traza, id de usuario y navegador. Tope global: 60 por
--      minuto (el resto se descarta en silencio) y textos recortados.
--
-- NO toca ninguna tabla existente ni ningún dato financiero.
-- Marcha atrás: 2026-11-fase3-beta-rollback.sql
-- =====================================================================

begin;

-- 1. Administradores -------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

-- Moha (dueño histórico de los datos). Si no existe en este proyecto, no hace nada.
insert into public.app_admins (user_id)
select id from auth.users where id = '8c449806-d8b4-498a-98d7-28809bb7c95a'
on conflict do nothing;

create or replace function public.is_garra_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_garra_admin() from public, anon;
grant execute on function public.is_garra_admin() to authenticated;

-- 2. Comentarios -----------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('fallo', 'idea')),
  message text not null check (char_length(message) between 3 and 2000),
  page text check (page is null or char_length(page) <= 300),
  email text check (email is null or char_length(email) <= 255),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  status text not null default 'nuevo' check (status in ('nuevo', 'visto', 'hecho')),
  created_at timestamptz not null default now()
);
-- (por si la tabla ya existía de una versión anterior sin esta columna)
alter table public.feedback add column if not exists email text check (email is null or char_length(email) <= 255);
create index if not exists idx_feedback_created on public.feedback (created_at desc);
create index if not exists idx_feedback_user_created on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;
drop policy if exists "feedback_insert_propio" on public.feedback;
drop policy if exists "feedback_select_admin" on public.feedback;
drop policy if exists "feedback_update_admin" on public.feedback;
create policy "feedback_insert_propio" on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'nuevo');
create policy "feedback_select_admin" on public.feedback for select to authenticated
  using ((select public.is_garra_admin()));
create policy "feedback_update_admin" on public.feedback for update to authenticated
  using ((select public.is_garra_admin())) with check ((select public.is_garra_admin()));
revoke all on public.feedback from anon, authenticated;
grant select, insert, update on public.feedback to authenticated;

create or replace function public.feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.feedback f
      where f.user_id = new.user_id and f.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Demasiados comentarios seguidos. Prueba dentro de un rato.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.feedback_rate_limit() from public, anon, authenticated;
drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit before insert on public.feedback
  for each row execute function public.feedback_rate_limit();

-- 3. Errores ---------------------------------------------------------
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  source text not null check (source in ('navegador', 'servidor')),
  route text,
  message text not null,
  stack text,
  digest text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_errors_created on public.app_errors (created_at desc);

alter table public.app_errors enable row level security;
drop policy if exists "app_errors_insert_propio" on public.app_errors;
drop policy if exists "app_errors_insert_anonimo" on public.app_errors;
drop policy if exists "app_errors_select_admin" on public.app_errors;
create policy "app_errors_insert_propio" on public.app_errors for insert to authenticated
  with check (user_id is null or user_id = (select auth.uid()));
-- Errores sin sesión (pantalla de entrar, servidor): solo sin user_id.
-- La clave anon ya no llega al navegador; solo la usa el servidor.
create policy "app_errors_insert_anonimo" on public.app_errors for insert to anon
  with check (user_id is null);
create policy "app_errors_select_admin" on public.app_errors for select to authenticated
  using ((select public.is_garra_admin()));
revoke all on public.app_errors from anon, authenticated;
grant insert on public.app_errors to anon, authenticated;
grant select on public.app_errors to authenticated;

-- Recorta textos y descarta avalanchas (más de 60 errores en el último minuto).
create or replace function public.app_errors_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.app_errors e where e.created_at > now() - interval '1 minute') >= 60 then
    return null;
  end if;
  new.route := left(new.route, 300);
  new.message := left(coalesce(nullif(new.message, ''), 'Error sin mensaje'), 1000);
  new.stack := left(new.stack, 4000);
  new.digest := left(new.digest, 100);
  new.user_agent := left(new.user_agent, 300);
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.app_errors_guard() from public, anon, authenticated;
drop trigger if exists app_errors_guard on public.app_errors;
create trigger app_errors_guard before insert on public.app_errors
  for each row execute function public.app_errors_guard();

-- Limpieza: errores de más de 90 días se pueden borrar a mano con
--   delete from public.app_errors where created_at < now() - interval '90 days';

-- Que la API vea las tablas/columnas nuevas al momento.
notify pgrst, 'reload schema';

commit;
