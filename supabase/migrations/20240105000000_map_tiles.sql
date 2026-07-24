-- =====================================================================
-- Map tiling support.
--
-- Until now a map was one single image, uploaded and served whole —
-- both the upload (Supabase Storage has a per-file size limit) and,
-- more importantly, every client's first paint (DM and every
-- observer download the full-resolution image before they can see
-- anything) scaled badly as maps got bigger.
--
-- This migration only adds the metadata the client needs to switch a
-- map over to a tile pyramid (see MapTileService / TileGenerator on
-- the client): tiles are sliced and uploaded in the browser at
-- upload time, one small file per {zoom}/{x}_{y}, and Leaflet then
-- only fetches the handful of tiles that are actually on screen.
--
-- image_path / width / height are untouched and keep meaning what
-- they meant before — the original full image is still uploaded and
-- kept as a source file (useful for re-tiling later, and as an
-- immediate fallback so the map is never fully unusable while tiles
-- are mid-generation or if tiling fails for some reason).
-- =====================================================================

alter table maps add column if not exists tile_size integer not null default 256;
alter table maps add column if not exists native_zoom integer;
alter table maps add column if not exists tile_ext text;
alter table maps add column if not exists tiles_ready boolean not null default false;


-- =====================================================================
-- STORAGE — bucket for tiles
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('map-tiles', 'map-tiles', true)
on conflict (id) do nothing;


-- =====================================================================
-- STORAGE — RLS policies
-- Same shape as the existing "map-images" policies: public read,
-- writes gated by is_world_dm() on the first path segment. Tile
-- paths are `${worldId}/${mapId}/${z}/${x}_${y}.${ext}`, so
-- storage.foldername(name)[1] is still the world id.
-- =====================================================================

drop policy if exists "Anyone can read map tiles" on storage.objects;
create policy "Anyone can read map tiles"
on storage.objects for select
using (bucket_id = 'map-tiles');

drop policy if exists "DM can upload map tiles for their worlds" on storage.objects;
create policy "DM can upload map tiles for their worlds"
on storage.objects for insert
with check (
  bucket_id = 'map-tiles'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);

drop policy if exists "DM can update their map tiles" on storage.objects;
create policy "DM can update their map tiles"
on storage.objects for update
using (
  bucket_id = 'map-tiles'
  and is_world_dm((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'map-tiles'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);

drop policy if exists "DM can delete their map tiles" on storage.objects;
create policy "DM can delete their map tiles"
on storage.objects for delete
using (
  bucket_id = 'map-tiles'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);
