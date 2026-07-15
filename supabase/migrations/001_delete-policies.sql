-- Владелец может удалить свой мир (участники/карты/локации удалятся
-- каскадно — на них уже стоит "on delete cascade" в схеме)
create policy "Owner can delete their world"
on worlds for delete
using (owner_id = auth.uid());

-- DM может удалить файл картинки карты своего мира
create policy "DM can delete their map images"
on storage.objects for delete
using (
  bucket_id = 'map-images'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);
