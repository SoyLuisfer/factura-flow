create policy "anon lee facturas" on storage.objects for select to anon using (bucket_id = 'facturas');
create policy "anon sube facturas" on storage.objects for insert to anon with check (bucket_id = 'facturas');
create policy "anon borra facturas" on storage.objects for delete to anon using (bucket_id = 'facturas');