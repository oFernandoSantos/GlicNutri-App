create table if not exists public.refeicao_ia (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null,
  foto_url text,
  alimentos jsonb not null,
  carboidratos_total numeric,
  calorias_total numeric,
  proteinas_total numeric,
  gorduras_total numeric,
  confirmado boolean default false,
  created_at timestamp default now()
);

create index if not exists idx_refeicao_ia_paciente_created_at
on public.refeicao_ia (paciente_id, created_at desc);

alter table public.refeicao_ia disable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'refeicoes-ia',
  'refeicoes-ia',
  false,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow meal IA uploads'
  ) then
    create policy "Allow meal IA uploads"
    on storage.objects
    for insert
    to anon, authenticated
    with check (
      bucket_id = 'refeicoes-ia'
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png')
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow meal IA reads'
  ) then
    create policy "Allow meal IA reads"
    on storage.objects
    for select
    to anon, authenticated
    using (
      bucket_id = 'refeicoes-ia'
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png')
    );
  end if;
end
$$;
