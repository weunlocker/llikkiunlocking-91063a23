insert into storage.buckets (id, name, public) values ('email-assets','email-assets',true) on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='email-assets public read') then
    create policy "email-assets public read" on storage.objects for select using (bucket_id = 'email-assets');
  end if;
end $$;