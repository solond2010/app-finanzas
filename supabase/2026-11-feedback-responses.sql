-- Respuestas privadas del administrador a comentarios de usuarios.
-- La respuesta y el cierre del comentario se guardan en una única transacción.
-- Los comentarios anónimos de la demo conservan su estado, pero no se pueden
-- responder porque no tienen una cuenta a la que entregar la notificación.

begin;

create table if not exists public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null unique references public.feedback(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_feedback_replies_user_created
  on public.feedback_replies (user_id, created_at desc);

alter table public.feedback_replies enable row level security;
drop policy if exists "feedback_replies_select_owner_or_admin" on public.feedback_replies;
drop policy if exists "feedback_replies_update_owner" on public.feedback_replies;
create policy "feedback_replies_select_owner_or_admin" on public.feedback_replies
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_garra_admin()));
create policy "feedback_replies_update_owner" on public.feedback_replies
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.feedback_replies from anon, authenticated;
grant select, update (read_at) on public.feedback_replies to authenticated;
grant select, insert, update on public.feedback_replies to service_role;

create or replace function public.respond_to_feedback(p_feedback_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.feedback%rowtype;
  clean_message text := btrim(coalesce(p_message, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (select public.is_garra_admin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if char_length(clean_message) < 3 or char_length(clean_message) > 2000 then
    raise exception 'La respuesta debe tener entre 3 y 2000 caracteres' using errcode = '22023';
  end if;

  select * into target
    from public.feedback
    where id = p_feedback_id
    for update;
  if not found then
    raise exception 'No se encontró el comentario' using errcode = 'P0002';
  end if;
  if target.user_id is null then
    raise exception 'El comentario anónimo no admite respuesta privada' using errcode = '22023';
  end if;

  insert into public.feedback_replies (feedback_id, user_id, message)
  values (target.id, target.user_id, clean_message);

  update public.feedback set status = 'hecho' where id = target.id;
end;
$$;

revoke all on function public.respond_to_feedback(uuid, text) from public, anon;
grant execute on function public.respond_to_feedback(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
