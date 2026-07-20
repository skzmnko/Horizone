-- =====================================================================
-- Fix: any member of a world could read EVERY membership row of that
-- world (including other users' rows), not just their own.
--
-- Cause: "Members can view membership of their worlds" used
-- `is_world_member(world_id)` as the USING clause — this only checks
-- that the CALLER is *a* member of the world, it says nothing about
-- WHICH ROW is being read. So querying world_members returned every
-- row belonging to that world (the owner's 'dm' row AND every
-- player's row) to anyone who is a member, regardless of whose row
-- it actually was.
--
-- Combined with WorldsService.getMyWorlds() not filtering by user_id
-- (it relied on RLS to scope the query to "my rows"), this caused,
-- for any world with 2+ members:
--   - both users seeing TWO cards for the same world instead of one
--     (one row per member, all of them returned to everybody);
--   - the role shown to a user could belong to a DIFFERENT member —
--     e.g. a player seeing a stray 'dm' row and the UI treating it as
--     their own role, showing master-only controls.
--
-- Fix: a plain member may only read THEIR OWN membership row
-- (`user_id = auth.uid()`). The DM still needs to see every member of
-- their world (for a future member-management panel, etc.) — that is
-- already covered separately by the existing "DM can manage members"
-- policy (`for all` / `is_world_dm(world_id)`), which stays as is.
-- RLS policies for the same command are combined with OR, so DMs are
-- unaffected: they still see the full membership list of worlds they
-- run, while regular members now only ever see their own row.
-- =====================================================================

drop policy if exists "Members can view membership of their worlds" on world_members;
create policy "Users can view their own membership" on world_members
for select
using (user_id = auth.uid());
