create table if not exists public.produtos_rotulo_cache (
  code text primary key,
  nome text not null,
  marca text,
  categoria text,
  porcao text,
  nutriments jsonb not null default '{}'::jsonb,
  produto_normalizado jsonb not null default '{}'::jsonb,
  fonte text not null default 'Open Food Facts',
  updated_at timestamp with time zone not null default timezone('utc', now())
);

create index if not exists idx_produtos_rotulo_cache_nome
on public.produtos_rotulo_cache using gin (to_tsvector('portuguese', coalesce(nome, '')));

create index if not exists idx_produtos_rotulo_cache_marca
on public.produtos_rotulo_cache (marca);

alter table public.produtos_rotulo_cache disable row level security;

grant select, insert, update on public.produtos_rotulo_cache to anon, authenticated;

alter table public.refeicao_ia
  add column if not exists fibras_total numeric,
  add column if not exists acucares_total numeric,
  add column if not exists gorduras_saturadas_total numeric,
  add column if not exists sodio_total numeric;
