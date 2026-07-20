-- =====================================================================
-- Trace & Place — full database deployment from scratch.
-- Idempotent: safe to run again on a database where the schema
-- already exists (e.g. during an automatic migration run from git) —
-- nothing will fail with an "already exists" error.
--
-- This file accumulates, in order, everything that used to live in
-- separate migration files:
--   000_full_schema.sql
--   001_invite_enhancements.sql
--   002_fix_display_name_check.sql
--   003_world_visibility.sql
--   001_fix_world_members_visibility.sql  <-- INTEGRATED
-- Running this single file top to bottom produces the exact same
-- end state as running all five of the original files in sequence.
-- =====================================================================


-- =====================================================================
-- 1. EXTENSIONS
-- =====================================================================
create extension if not exists "pgcrypto";


-- =====================================================================
-- 2. TABLES
-- =====================================================================

create table if not exists worlds (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid references auth.users(id) not null,
    name text not null,
    cover_image_path text,
    created_at timestamptz default now()
);

create table if not exists world_members (
    world_id uuid references worlds(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    role text check (role in ('dm', 'player')) not null default 'player',
    joined_at timestamptz default now(),
    primary key (world_id, user_id)
);

create table if not exists maps (
    id uuid primary key default gen_random_uuid(),
    world_id uuid references worlds(id) on delete cascade,
    name text not null,
    width integer default 10000,
    height integer default 10000,
    image_path text,
    created_at timestamptz default now()
);

create table if not exists locations (
    id uuid primary key default gen_random_uuid(),
    map_id uuid references maps(id) on delete cascade,
    type text not null,
    name text not null,
    alias text,
    region text,
    description text,
    image_url text,
    coord_x numeric not null,
    coord_y numeric not null,
    known boolean not null default false,
    ruler text,
    owner text,
    family text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists world_invites (
    id uuid primary key default gen_random_uuid(),
    world_id uuid references worlds(id) on delete cascade,
    code text unique not null,
    created_at timestamptz default now(),
    expires_at timestamptz
);

-- Public user profile. Separate from auth.users because:
-- 1) auth.users is not directly accessible to client queries;
-- 2) display_name must be unique — and user_metadata doesn't work for
--    that (the user can freely change it themselves).
create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null unique,
    created_at timestamptz default now()
);

-- Separate display name (character name) specific to this world —
-- if not set, profiles.display_name is used instead.
alter table world_members add column if not exists display_name text;

-- In case worlds/world_members were created earlier without these columns
alter table worlds add column if not exists cover_image_path text;


-- =====================================================================
-- 3. HELPER FUNCTIONS (create or replace — already idempotent)
-- =====================================================================

create or replace function is_world_member(_world_id uuid)
returns boolean as $$
  select exists (
    select 1 from world_members
    where world_id = _world_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function is_world_dm(_world_id uuid)
returns boolean as $$
  select exists (
    select 1 from world_members
    where world_id = _world_id and user_id = auth.uid() and role = 'dm'
  );
$$ language sql security definer stable;


-- =====================================================================
-- 4. RPC FUNCTIONS
-- =====================================================================

-- Create a world: the world itself + the master as a member.
-- The map is NOT created automatically — the DM creates it explicitly
-- when uploading an image, so the database doesn't accumulate "empty"
-- maps without an image.
create or replace function create_world(_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  _world_id uuid;
begin
  insert into worlds (owner_id, name)
  values (auth.uid(), _name)
  returning id into _world_id;

  insert into world_members (world_id, user_id, role)
  values (_world_id, auth.uid(), 'dm');

  return _world_id;
end;
$$;

-- NOTE: this initial version of redeem_invite is immediately replaced
-- further down (see section 14, "Invite enhancements") by a version
-- that also respects the usage limit and requires authentication.
-- Kept here to preserve the original migration history.
create or replace function redeem_invite(_code text, _display_name text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  _world_id uuid;
begin
  select world_id into _world_id
  from world_invites
  where code = _code
    and (expires_at is null or expires_at > now());

  if _world_id is null then
    raise exception 'Invite code not found or expired';
  end if;

  insert into world_members (world_id, user_id, role, display_name)
  values (_world_id, auth.uid(), 'player', nullif(_display_name, ''))
  on conflict (world_id, user_id) do nothing;

  return _world_id;
end;
$$;

-- A player can change their display name (character name) in this
-- specific world at any time. A separate RPC instead of a general
-- UPDATE policy — so the player physically cannot use the same path
-- to change their role or world_id, only their own display name.
create or replace function set_my_world_display_name(_world_id uuid, _display_name text)
returns void
language plpgsql
security definer
as $$
begin
  update world_members
  set display_name = nullif(_display_name, '')
  where world_id = _world_id and user_id = auth.uid();
end;
$$;

-- Automatically create a profile as soon as the user registers.
-- The name is taken from user_metadata (passed during signUp), or from the email.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill: users created BEFORE the trigger existed (e.g. test
-- accounts from the Dashboard) don't have a profile yet — create it.
-- If any of them happen to end up with the same default name, this
-- insert will fail on the unique constraint; that normally doesn't
-- happen for a couple of test accounts.
insert into public.profiles (id, display_name)
select id, coalesce(nullif(raw_user_meta_data->>'display_name', ''), split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- NOTE: this initial version of is_display_name_available is
-- immediately replaced further down (see section 15, "Fix: display 
-- name availability check") by a security definer version that fixes 
-- the RLS bug described there. Kept here to preserve the original 
-- migration history.
--
-- Check whether a display_name is taken (used on the registration
-- form before submission — this is a UX hint, not the only
-- safeguard: final uniqueness is still enforced by the "unique"
-- constraint on the column)
create or replace function is_display_name_available(_name text)
returns boolean
language sql
stable
as $$
  select not exists (select 1 from profiles where display_name = _name);
$$;

-- worlds.owner_id was originally created WITHOUT on delete cascade —
-- because of this, deleting a user who owns at least one world failed
-- with a foreign key error. Recreating the constraint with cascade, so
-- worlds get deleted together with their owner (everything else is
-- already cascading: world_members/maps/locations depend on worlds,
-- profiles depends on auth.users).
alter table worlds drop constraint if exists worlds_owner_id_fkey;
alter table worlds add constraint worlds_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete cascade;

-- Self-service account deletion. security definer is required because
-- deleting from auth.users is not possible with regular client
-- permissions — but the function itself only ever deletes strictly
-- the current user (auth.uid()), nothing else.
create or replace function delete_my_account()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;


-- =====================================================================
-- 5. ENABLE ROW LEVEL SECURITY (idempotent on its own)
-- =====================================================================

alter table worlds enable row level security;
alter table world_members enable row level security;
alter table maps enable row level security;
alter table locations enable row level security;
alter table world_invites enable row level security;
alter table profiles enable row level security;


-- =====================================================================
-- 6-10. RLS POLICIES
-- The "drop if exists + create" pattern makes policy creation
-- idempotent (a plain "create policy" fails with an error if a
-- policy with that name already exists).
-- =====================================================================

-- NOTE: this initial "Members can view their worlds" policy is
-- replaced further down (see section 16, "World visibility") by
-- "Users can view accessible worlds", which also allows public
-- worlds to be seen by any authenticated user. Kept here to
-- preserve the original migration history.
drop policy if exists "Members can view their worlds" on worlds;
create policy "Members can view their worlds"
on worlds for select
using (is_world_member(id));

drop policy if exists "Authenticated users can create world" on worlds;
create policy "Authenticated users can create world"
on worlds for insert
with check (owner_id = auth.uid());

drop policy if exists "Owner can update their world" on worlds;
create policy "Owner can update their world"
on worlds for update
using (owner_id = auth.uid());

drop policy if exists "Owner can delete their world" on worlds;
create policy "Owner can delete their world"
on worlds for delete
using (owner_id = auth.uid());


-- =====================================================================
-- 6.5. FIXED: world_members RLS policies (formerly 001_fix_world_members_visibility.sql)
-- =====================================================================

-- CRITICAL FIX: Original policy allowed any member of a world to read 
-- EVERY membership row of that world (including other users' rows), 
-- not just their own.
--
-- What was wrong:
--   "Members can view membership of their worlds" used 
--   `is_world_member(world_id)` as the USING clause — this only checks
--   that the CALLER is *a* member of the world, it says nothing about
--   WHICH ROW is being read. So querying world_members returned every
--   row belonging to that world to anyone who is a member, regardless
--   of whose row it actually was.
--
-- Fix: a plain member may only read THEIR OWN membership row 
-- (`user_id = auth.uid()`). The DM still needs to see every member of
-- their world (for a future member-management panel) — that is already
-- covered separately by the existing "DM can manage members" policy
-- (`for all` / `is_world_dm(world_id)`), which stays as is.
-- RLS policies for the same command are combined with OR, so DMs are
-- unaffected: they still see the full membership list of worlds they
-- run, while regular members now only ever see their own row.
drop policy if exists "Members can view membership of their worlds" on world_members;
drop policy if exists "Users can view their own membership" on world_members;
create policy "Users can view their own membership" on world_members
for select
using (user_id = auth.uid());

-- DM policy remains unchanged (covers both select and manage operations)
drop policy if exists "DM can manage members" on world_members;
create policy "DM can manage members"
on world_members for all
using (is_world_dm(world_id))
with check (is_world_dm(world_id));


-- =====================================================================
-- 7. Maps RLS policies
-- =====================================================================

drop policy if exists "Members can view maps" on maps;
create policy "Members can view maps"
on maps for select
using (is_world_member(world_id));

drop policy if exists "DM can manage maps" on maps;
create policy "DM can manage maps"
on maps for all
using (is_world_dm(world_id))
with check (is_world_dm(world_id));


-- =====================================================================
-- 8. Locations RLS policies
-- =====================================================================

drop policy if exists "Members can view visible locations" on locations;
create policy "Members can view visible locations"
on locations for select
using (
  exists (
    select 1 from maps m
    where m.id = locations.map_id
    and (
      is_world_dm(m.world_id)
      or (is_world_member(m.world_id) and locations.known = true)
    )
  )
);

drop policy if exists "DM can manage locations" on locations;
create policy "DM can manage locations"
on locations for all
using (
  exists (select 1 from maps m where m.id = locations.map_id and is_world_dm(m.world_id))
)
with check (
  exists (select 1 from maps m where m.id = locations.map_id and is_world_dm(m.world_id))
);


-- =====================================================================
-- 9. World invites RLS policies
-- =====================================================================

drop policy if exists "DM can manage invites" on world_invites;
create policy "DM can manage invites"
on world_invites for all
using (is_world_dm(world_id))
with check (is_world_dm(world_id));

drop policy if exists "Authenticated users can look up invite by code" on world_invites;
create policy "Authenticated users can look up invite by code"
on world_invites for select
using (auth.role() = 'authenticated');


-- =====================================================================
-- 10. Profiles RLS policies
-- =====================================================================

-- Profiles: the display name is visible to everyone authenticated
-- (needed to show world members by name), only the user themselves
-- can edit their own profile.
drop policy if exists "Anyone authenticated can view profiles" on profiles;
create policy "Anyone authenticated can view profiles"
on profiles for select
using (auth.role() = 'authenticated');

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
on profiles for update
using (id = auth.uid())
with check (id = auth.uid());


-- =====================================================================
-- 11. REALTIME
-- "alter publication ... add table" fails with an error if the table
-- is already in the publication — wrap it in a check through
-- pg_publication_tables.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'locations'
  ) then
    alter publication supabase_realtime add table locations;
  end if;
end $$;


-- =====================================================================
-- 12. STORAGE — buckets
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('map-images', 'map-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('world-covers', 'world-covers', true)
on conflict (id) do nothing;


-- =====================================================================
-- 13. STORAGE — RLS policies
-- =====================================================================

drop policy if exists "Anyone can read map images" on storage.objects;
create policy "Anyone can read map images"
on storage.objects for select
using (bucket_id = 'map-images');

drop policy if exists "DM can upload map images for their worlds" on storage.objects;
create policy "DM can upload map images for their worlds"
on storage.objects for insert
with check (
  bucket_id = 'map-images'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);

drop policy if exists "DM can update their map images" on storage.objects;
create policy "DM can update their map images"
on storage.objects for update
using (
  bucket_id = 'map-images'
  and is_world_dm((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'map-images'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);

drop policy if exists "DM can delete their map images" on storage.objects;
create policy "DM can delete their map images"
on storage.objects for delete
using (
  bucket_id = 'map-images'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Anyone can read world covers" on storage.objects;
create policy "Anyone can read world covers"
on storage.objects for select
using (bucket_id = 'world-covers');

drop policy if exists "DM can upload cover for their world" on storage.objects;
create policy "DM can upload cover for their world"
on storage.objects for insert
with check (
  bucket_id = 'world-covers'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);

drop policy if exists "DM can update their world cover" on storage.objects;
create policy "DM can update their world cover"
on storage.objects for update
using (
  bucket_id = 'world-covers'
  and is_world_dm((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'world-covers'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);

drop policy if exists "DM can delete their world cover" on storage.objects;
create policy "DM can delete their world cover"
on storage.objects for delete
using (
  bucket_id = 'world-covers'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);


-- =====================================================================
-- 14. Invite system enhancements (formerly 001_invite_enhancements.sql)
-- Idempotent, like the previous section.
--
-- Adds:
--   1) a usage limit and authorship for the invite code;
--   2) invited_email — a placeholder for future use (see README-INVITES.md):
--      personal invitations that will find the user in their personal
--      cabinet by email, without manual code entry;
--   3) redeem_invite — now respects the usage limit and explicitly
--      requires authentication;
--   4) get_invite_preview — the only RPC that can be called
--      ANONYMOUSLY (without logging in). Returns only the world name
--      and the DM's name — enough to show a banner like "You have
--      been invited to the world «Oraska»" on the login/registration
--      screen, without revealing anything more to an unauthorized
--      person.
-- =====================================================================

alter table world_invites add column if not exists max_uses integer;
alter table world_invites add column if not exists uses_count integer not null default 0;
alter table world_invites add column if not exists created_by uuid references auth.users(id);

-- Future-proofing: a personal invite tied to a specific email.
-- Not currently used in the current flow (see `redeem_invite`) — the
-- code works as a regular one regardless of this field. Once a
-- personal account with incoming invitations is implemented, this
-- same field can be used to match them by the user's email without
-- changing the table structure.
alter table world_invites add column if not exists invited_email text;


create or replace function redeem_invite(_code text, _display_name text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  _world_id uuid;
  _invite_id uuid;
  _max_uses integer;
  _uses_count integer;
  _already_member boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id, world_id, max_uses, uses_count
    into _invite_id, _world_id, _max_uses, _uses_count
  from world_invites
  where code = _code
    and (expires_at is null or expires_at > now());

  if _world_id is null then
    raise exception 'Invite code not found or expired';
  end if;

  select exists(
    select 1 from world_members where world_id = _world_id and user_id = auth.uid()
  ) into _already_member;

  -- If the user is already a member of the world (re-entered via the
  -- same link) — just return the world_id, without touching the usage
  -- limit and without overwriting the already chosen character name.
  if not _already_member then
    if _max_uses is not null and _uses_count >= _max_uses then
      raise exception 'Invite code has reached its usage limit';
    end if;

    insert into world_members (world_id, user_id, role, display_name)
    values (_world_id, auth.uid(), 'player', nullif(_display_name, ''));

    update world_invites set uses_count = uses_count + 1 where id = _invite_id;
  end if;

  return _world_id;
end;
$$;

-- Public (anonymous) invitation preview — given the code, returns
-- only the world name and the master's name, without granting access
-- to the world's data itself.
create or replace function get_invite_preview(_code text)
returns table(world_name text, dm_name text)
language sql
security definer
stable
as $$
  select w.name, p.display_name
  from world_invites wi
  join worlds w on w.id = wi.world_id
  join world_members wm on wm.world_id = w.id and wm.role = 'dm'
  join profiles p on p.id = wm.user_id
  where wi.code = _code
    and (wi.expires_at is null or wi.expires_at > now())
    and (wi.max_uses is null or wi.uses_count < wi.max_uses)
  limit 1;
$$;

grant execute on function get_invite_preview(text) to anon, authenticated;

-- List of active world invitations — for the DM panel ("my invite
-- codes" with usage status and the ability to revoke).
create or replace function get_world_invites(_world_id uuid)
returns table(
  id uuid,
  code text,
  created_at timestamptz,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer
)
language sql
security definer
stable
as $$
  select wi.id, wi.code, wi.created_at, wi.expires_at, wi.max_uses, wi.uses_count
  from world_invites wi
  where wi.world_id = _world_id
    and is_world_dm(_world_id)
  order by wi.created_at desc;
$$;

grant execute on function get_world_invites(uuid) to authenticated;


-- =====================================================================
-- 15. Fix: display name availability check
-- (formerly 002_fix_display_name_check.sql)
--
-- Fix: is_display_name_available always returned true for an
-- anonymous caller (i.e. specifically during registration — exactly
-- when it's called).
--
-- Cause: the function had no `security definer`, so it ran with the
-- caller's own privileges (security invoker). The RLS policy on
-- profiles ("Anyone authenticated can view profiles") only admits the
-- authenticated role — but on the registration form the user is still
-- anonymous (anon). RLS silently hid every row of profiles, so
-- `select 1 from profiles where display_name = _name` found NOTHING,
-- and `not exists(...)` was always true — regardless of whether the
-- name was actually taken.
--
-- Because of this, the frontend check (checkDisplayNameAvailable)
-- silently let even genuinely taken names through, and the real
-- conflict only surfaced at signUp() itself — as a generic Supabase
-- Auth error ("Database error saving new user"), which is hard to
-- reliably distinguish from any other trigger error by its text.
--
-- Every other RPC in the project (redeem_invite, create_world,
-- set_my_world_display_name, delete_my_account, get_invite_preview,
-- get_world_invites...) was already security definer — this was the
-- only function that had been missed.
-- =====================================================================

create or replace function is_display_name_available(_name text)
returns boolean
language sql
security definer
stable
as $$
  select not exists (select 1 from profiles where display_name = _name);
$$;


-- =====================================================================
-- 16. World visibility (is_public)
-- (formerly 003_world_visibility.sql)
--
-- 1.1: a new world is private by default (is_public = false) and
--      visible only to its owner — nothing extra needs to be done for
--      this, since is_world_member() already includes the owner
--      (create_world() immediately adds them to world_members with
--      the 'dm' role).
-- 1.2: if the owner makes a world public, it must become visible to
--      ALL registered (authenticated) users — not just members. This
--      only concerns the world's own row (name, cover image) — access
--      to the maps and locations inside the world is still governed
--      by separate policies and remains limited to members
--      (world_members); is_public has no effect on those.
-- =====================================================================

alter table worlds add column if not exists is_public boolean not null default false;

drop policy if exists "Members can view their worlds" on worlds;
drop policy if exists "Users can view accessible worlds" on worlds;
create policy "Users can view accessible worlds"
on worlds for select
using (is_world_member(id) or is_public = true);

-- The insert/update/delete policies don't change: "Owner can update
-- their world" already allows the owner (owner_id = auth.uid()) to
-- change any field of their world, including is_public.


-- =====================================================================
-- End.
-- =====================================================================