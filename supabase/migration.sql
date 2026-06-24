-- Crear tablas para la app de finanzas
-- Ejecuta esto en Supabase Dashboard > SQL Editor

create table if not exists accounts (
  id text primary key,
  nombre text not null,
  tipo text not null,
  banco text not null default '',
  saldo numeric not null default 0,
  objetivo numeric,
  limite_mensual numeric,
  color text not null default '#3b82f6',
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
  created_at timestamptz default now()
);

create table if not exists sinking_funds (
  id text primary key,
  nombre text not null,
  objetivo numeric not null default 0,
  ahorrado numeric not null default 0,
  fecha_limite text,
  color text not null default '#10b981',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices para consultas rápidas
create index if not exists idx_transactions_cuenta_id on transactions(cuenta_id);
create index if not exists idx_transactions_fecha on transactions(fecha);
create index if not exists idx_transactions_tipo on transactions(tipo);

-- Desactivar RLS para que el anon key pueda leer/escribir sin autenticación
alter table accounts disable row level security;
alter table transactions disable row level security;
alter table sinking_funds disable row level security;
