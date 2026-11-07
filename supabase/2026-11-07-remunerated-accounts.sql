-- Configuración opcional de intereses para cuentas remuneradas.
-- Ejecutar una vez en Supabase > SQL Editor antes de guardar la configuración
-- de una cuenta remunerada desde la nueva versión de la app.

alter table public.accounts
  add column if not exists interest_tae numeric,
  add column if not exists interest_frequency text,
  add column if not exists interest_start_date date,
  add column if not exists interest_last_payment_date date,
  add column if not exists interest_balance_cap numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_interest_tae_range'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_interest_tae_range
      check (interest_tae is null or (interest_tae >= 0 and interest_tae <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_interest_frequency_values'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_interest_frequency_values
      check (interest_frequency is null or interest_frequency in ('daily', 'monthly', 'quarterly', 'semiannual', 'annual'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_interest_balance_cap_positive'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_interest_balance_cap_positive
      check (interest_balance_cap is null or interest_balance_cap > 0);
  end if;
end $$;

comment on column public.accounts.interest_tae is 'TAE anual usada solo para estimar intereses; no se suma al saldo.';
comment on column public.accounts.interest_frequency is 'Frecuencia con la que el banco abona los intereses.';
comment on column public.accounts.interest_start_date is 'Fecha desde la que empieza la estimación de intereses.';
comment on column public.accounts.interest_last_payment_date is 'Fecha del último abono real de intereses por el banco.';
comment on column public.accounts.interest_balance_cap is 'Saldo máximo que el banco remunera; null significa sin límite.';
