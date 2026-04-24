insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audit-logs',
  'audit-logs',
  false,
  1048576,
  array['application/json']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow app audit uploads'
  ) then
    create policy "Allow app audit uploads"
    on storage.objects
    for insert
    to anon, authenticated
    with check (
      bucket_id = 'audit-logs'
      and (storage.foldername(name))[1] = 'app'
      and storage.extension(name) = 'json'
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
      and policyname = 'Allow app audit reads'
  ) then
    create policy "Allow app audit reads"
    on storage.objects
    for select
    to anon, authenticated
    using (
      bucket_id = 'audit-logs'
      and (storage.foldername(name))[1] = 'app'
      and storage.extension(name) = 'json'
    );
  end if;
end
$$;
