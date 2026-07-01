-- Crear tablas para la app de finanzas
-- Ejecuta esto en Supabase Dashboard > SQL Editor
--
-- Nota: este script recrea el esquema base desde cero. Si tu proyecto de Supabase
-- ya existe, algunas columnas (asset_class, dca_*) se añaden por separado —
-- revisa supabase-assetclass.sql y supabase-dca.sql también.

create table if not exists accounts (
  id text primary key,
  nombre text not null,
  tipo text not null,
  banco text not null default '',
  saldo numeric not null default 0,
  objetivo numeric,
  limite_mensual numeric,
  color text not null default '#3b82f6',
  user_id uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists transactions (
  id text primary key,
  cuenta_id text not null references accounts(id) on delete cascade,
  monto numeric not null,
  fecha text not null,
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  categoria text not null,
  es_necesidad boolean not null default true,
  descripcion text not null default '',
  tags jsonb not null default '[]',
  user_id uuid not null,
  created_at timestamptz default now()
);

create table if not exists sinking_funds (
  id text primary key,
  nombre text not null,
  objetivo numeric not null default 0,
  ahorrado numeric not null default 0,
  fecha_limite text,
  color text not null default '#10b981',
  user_id uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists categories (
  id text primary key,
  name text not null,
  color text not null default '#3b82f6',
  user_id uuid not null
);

create table if not exists budgets (
  id text primary key,
  category_id text not null references categories(id) on delete cascade,
  amount numeric not null default 0,
  month text not null,
  user_id uuid not null
);

-- Índices para consultas rápidas
create index if not exists idx_transactions_cuenta_id on transactions(cuenta_id);
create index if not exists idx_transactions_fecha on transactions(fecha);
create index if not exists idx_transactions_tipo on transactions(tipo);
create index if not exists idx_budgets_category_id on budgets(category_id);

-- Desactivar RLS para que el anon key pueda leer/escribir sin autenticación
-- (la app filtra por user_id en el cliente; no hay auth multiusuario todavía)
alter table accounts disable row level security;
alter table transactions disable row level security;
alter table sinking_funds disable row level security;
alter table categories disable row level security;
alter table budgets disable row level security;
