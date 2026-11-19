-- Fuente admin_grant: Pro de por vida otorgado desde Administración.
-- Solo añade un valor permitido en source y protege esos derechos
-- frente a grant_first_fifty_if_eligible. No borra ni degrada planes.
-- Rollback: supabase/2026-11-admin-grant-rollback.sql

alter table public.user_plans drop constraint if exists user_plans_source_check;
alter table public.user_plans add constraint user_plans_source_check
  check (source in ('early_access', 'stripe', 'manual', 'first_fifty', 'admin_grant'));

create or replace function public.grant_first_fifty_if_eligible(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rank integer;
begin
  if p_user_id is null then
    return;
  end if;

  select count(*)::integer into rank
    from auth.users u
    join auth.users target on target.id = p_user_id
   where (u.created_at, u.id) <= (target.created_at, target.id);

  if rank is null or rank = 0 or rank > 50 then
    return;
  end if;

  insert into public.user_plans (user_id, plan, source)
  values (p_user_id, 'pro', 'first_fifty')
  on conflict (user_id) do update
    set plan = 'pro',
        source = 'first_fifty',
        updated_at = now()
    where public.user_plans.plan = 'free'
      and public.user_plans.source not in ('early_access', 'first_fifty', 'manual', 'admin_grant');
end;
$$;

revoke all on function public.grant_first_fifty_if_eligible(uuid) from public, anon, authenticated;
grant execute on function public.grant_first_fifty_if_eligible(uuid) to service_role;

notify pgrst, 'reload schema';
