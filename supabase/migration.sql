-- Crear tablas para la app de finanzas
-- Ejecuta esto en Supabase Dashboard > SQL Editor
--
-- Nota: este script crea el esquema base completo (todas las tablas que usa
-- la app hoy) desde cero. Si tu proyecto de Supabase ya existe y solo te
-- falta alguna columna añadida más tarde, revisa también estos otros
-- ficheros (cada uno es idempotente, se puede correr varias veces):
--   - supabase-assetclass.sql              (investments.asset_class)
--   - supabase-dca.sql                     (investments.dca_amount/dca_freq/dca_last)
--   - supabase-categorias.sql              (categories.kind)
--   - supabase-transactions-timestamp.sql  (transactions.created_at)
--   - supabase-account-logo.sql            (bucket de Storage "bank-logos" — accounts.logo_url ya está abajo)
--   - supabase-contributions.sql           (tabla investment_contributions, ya incluida abajo)

create table if not exists accounts (
  id text primary key,
  nombre text not null,
  tipo text not null,
  banco text not null default '',
  saldo numeric not null default 0,
  currency text not null default 'EUR',
  objetivo numeric,
  limite_mensual numeric,
  color text not null default '#3b82f6',
  logo_url text,
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
  kind text,
  user_id uuid not null
);

create table if not exists budgets (
  id text primary key,
  category_id text not null references categories(id) on delete cascade,
  amount numeric not null default 0,
  month text not null,
  user_id uuid not null
);

-- Ajustes simples clave-valor (objetivo de ingresos, objetivo de patrimonio,
-- cuenta favorita...). Al ser una app de un solo usuario, "key" es la clave
-- primaria (no hace falta componerla con user_id).
create table if not exists settings (
  key text primary key,
  value text not null,
  user_id uuid not null,
  updated_at timestamptz default now()
);

-- Activos en seguimiento (aún no comprados) en Inversiones.
create table if not exists watchlist (
  symbol text primary key,
  name text not null,
  user_id uuid not null,
  created_at timestamptz default now()
);

-- Posiciones de inversión (acciones, fondos, crypto o activos personalizados).
create table if not exists investments (
  id text primary key,
  kind text not null,
  symbol text not null,
  name text not null,
  isin text,
  date text not null,
  units numeric not null,
  buy_price numeric not null,
  currency text not null default 'EUR',
  account_id text references accounts(id) on delete set null,
  asset_class text,
  dca boolean not null default false,
  dca_amount numeric,
  dca_freq text,
  dca_last date,
  user_id uuid not null,
  created_at timestamptz default now()
);

-- Histórico de aportaciones mensuales por posición (compra inicial, DCA
-- aplicado o aporte manual), usado en la tabla "Aportaciones mensuales".
create table if not exists investment_contributions (
  id text primary key,
  position_id text not null references investments(id) on delete cascade,
  amount numeric not null,
  date date not null,
  user_id uuid not null,
  created_at timestamptz default now()
);

-- Índices para consultas rápidas
create index if not exists idx_transactions_cuenta_id on transactions(cuenta_id);
create index if not exists idx_transactions_fecha on transactions(fecha);
create index if not exists idx_transactions_tipo on transactions(tipo);
create index if not exists idx_budgets_category_id on budgets(category_id);
create index if not exists idx_investments_account_id on investments(account_id);
create index if not exists idx_investment_contributions_position_id on investment_contributions(position_id);

-- Desactivar RLS para que el anon key pueda leer/escribir sin autenticación
-- (la app filtra por user_id en el cliente; no hay auth multiusuario todavía)
alter table accounts disable row level security;
alter table transactions disable row level security;
alter table sinking_funds disable row level security;
alter table categories disable row level security;
alter table budgets disable row level security;
alter table settings disable row level security;
alter table watchlist disable row level security;
alter table investments disable row level security;
alter table investment_contributions disable row level security;
