-- =====================================================================
-- Fix: a world with several maps could send an invited observer to
-- whichever map happened to come back first from an UNORDERED query
-- (getMapsForWorld() had no `order by` at all) — including a map with
-- no image attached yet, even when other maps in the same world were
-- already ready. That's exactly the "Карта ещё не готова" bug report.
--
-- Fix has two parts:
-- 1) maps.is_main — lets the DM explicitly choose which map is the
--    "front door" of the world, instead of relying on implicit
--    creation order.
-- 2) is_main alone does not fully solve the bug on its own: if the
--    DM marks a map with no image yet as main, an observer would
--    still hit the same dead end, just deterministically instead of
--    randomly. The actual entry-point selection (see
--    WorldsService.getEntryMap() / main.js) always falls back to any
--    other map that does have an image before giving up — is_main is
--    a preference, not a hard requirement.
-- =====================================================================

alter table maps add column if not exists is_main boolean not null default false;

-- At most one main map per world. Partial unique index: only rows
-- with is_main = true participate in the uniqueness check, so any
-- number of non-main maps coexist freely.
drop index if exists maps_one_main_per_world;
create unique index maps_one_main_per_world on maps (world_id) where is_main;

-- Keep a sane, deterministic order everywhere maps are listed —
-- getMapsForWorld() previously had no `order by` at all. No RPC
-- needed for this part: WorldsService.getMapsForWorld() now just
-- adds .order('is_main', ...).order('created_at', ...) to its
-- existing PostgREST query.

-- Auto-designate a main map so DMs don't have to remember to babysit
-- this flag by hand:
--   - the first map ever created in a world becomes main automatically;
--   - if the current main map gets deleted, the next-oldest remaining
--     map (if any) is promoted, so a world with maps left never ends
--     up with zero main maps.
create or replace function maps_auto_main()
returns trigger
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from maps where world_id = new.world_id and is_main) then
    new.is_main := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_maps_auto_main on maps;
create trigger trg_maps_auto_main
  before insert on maps
  for each row execute function maps_auto_main();

create or replace function maps_promote_next_main()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.is_main then
    update maps
    set is_main = true
    where id = (
      select id from maps
      where world_id = old.world_id
      order by created_at asc
      limit 1
    );
  end if;
  return old;
end;
$$;

drop trigger if exists trg_maps_promote_next_main on maps;
create trigger trg_maps_promote_next_main
  after delete on maps
  for each row execute function maps_promote_next_main();

-- Explicit "set as main" action for the DM UI — one call, atomic
-- (unset the previous main map, set the new one), and gated by
-- is_world_dm() same as every other DM-only mutation in this schema.
create or replace function set_main_map(_map_id uuid, _world_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_world_dm(_world_id) then
    raise exception 'Only the DM can change the main map';
  end if;

  update maps set is_main = false where world_id = _world_id and is_main;
  update maps set is_main = true where id = _map_id and world_id = _world_id;
end;
$$;

grant execute on function set_main_map(uuid, uuid) to authenticated;

-- Backfill: worlds that already have maps but (obviously) predate
-- this migration get a main map assigned too — oldest map per world.
update maps m
set is_main = true
where m.id = (
  select id from maps m2
  where m2.world_id = m.world_id
  order by created_at asc
  limit 1
)
and not exists (
  select 1 from maps m3 where m3.world_id = m.world_id and m3.is_main
);
