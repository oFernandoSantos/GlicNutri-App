-- Chat: expor mensagem_chat no canal Realtime (leitura continua via RPC security definer).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'mensagem_chat'
    ) then
      alter publication supabase_realtime add table public.mensagem_chat;
    end if;
  end if;
end $$;

alter table public.mensagem_chat replica identity full;
