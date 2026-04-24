insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'system-logs',
  'system-logs',
  false,
  1048576,
  array['text/plain']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow system log uploads'
  ) then
    create policy "Allow system log uploads"
    on storage.objects
    for insert
    to anon, authenticated
    with check (
      bucket_id = 'system-logs'
      and (storage.foldername(name))[1] = 'runtime'
      and storage.extension(name) = 'txt'
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
      and policyname = 'Allow system log reads'
  ) then
    create policy "Allow system log reads"
    on storage.objects
    for select
    to anon, authenticated
    using (
      bucket_id = 'system-logs'
      and (storage.foldername(name))[1] = 'runtime'
      and storage.extension(name) = 'txt'
    );
  end if;
end
$$;
