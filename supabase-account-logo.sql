-- Logo personalizado por cuenta (subido por el usuario) + bucket de Storage
-- donde se guardan esas imágenes.
-- Ejecútalo en Supabase → SQL Editor. Es idempotente (puedes correrlo varias veces).

alter table public.accounts
  add column if not exists logo_url text; -- URL pública del logo subido (si no hay, se usa el logo de banco reconocido o un icono)

insert into storage.buckets (id, name, public)
values ('bank-logos', 'bank-logos', true)
on conflict (id) do nothing;

drop policy if exists "Public read bank logos" on storage.objects;
create policy "Public read bank logos" on storage.objects
  for select using (bucket_id = 'bank-logos');

drop policy if exists "Anon upload bank logos" on storage.objects;
create policy "Anon upload bank logos" on storage.objects
  for insert with check (bucket_id = 'bank-logos');

drop policy if exists "Anon update bank logos" on storage.objects;
create policy "Anon update bank logos" on storage.objects
  for update using (bucket_id = 'bank-logos');

drop policy if exists "Anon delete bank logos" on storage.objects;
create policy "Anon delete bank logos" on storage.objects
  for delete using (bucket_id = 'bank-logos');
