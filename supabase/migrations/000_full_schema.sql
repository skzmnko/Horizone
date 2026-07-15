-- =====================================================================
-- Orasca Map SaaS — полное развёртывание БД с нуля
-- Выполнять в Supabase SQL Editor одним файлом (сверху вниз), либо
-- блоками — порядок между блоками важен, внутри блока порядок неважен.
-- =====================================================================


-- =====================================================================
-- 1. РАСШИРЕНИЯ
-- =====================================================================
create extension if not exists "pgcrypto";


-- =====================================================================
-- 2. ТАБЛИЦЫ
-- =====================================================================

create table worlds (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid references auth.users(id) not null,
    name text not null,
    created_at timestamptz default now()
);

create table world_members (
    world_id uuid references worlds(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    role text check (role in ('dm', 'player')) not null default 'player',
    joined_at timestamptz default now(),
    primary key (world_id, user_id)
);

create table maps (
    id uuid primary key default gen_random_uuid(),
    world_id uuid references worlds(id) on delete cascade,
    name text not null,
    width integer default 10000,
    height integer default 10000,
    image_path text,
    created_at timestamptz default now()
);

create table locations (
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

create table world_invites (
    id uuid primary key default gen_random_uuid(),
    world_id uuid references worlds(id) on delete cascade,
    code text unique not null,
    created_at timestamptz default now(),
    expires_at timestamptz
);


-- =====================================================================
-- 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (используются в RLS-политиках)
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
-- 4. RPC-ФУНКЦИИ (многошаговые атомарные операции)
-- =====================================================================

-- Создание мира: сам мир + мастер как участник + карта по умолчанию
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

  insert into maps (world_id, name)
  values (_world_id, 'Основная карта');

  return _world_id;
end;
$$;

-- Присоединение к миру по инвайт-коду
create or replace function redeem_invite(_code text)
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

  insert into world_members (world_id, user_id, role)
  values (_world_id, auth.uid(), 'player')
  on conflict (world_id, user_id) do nothing;

  return _world_id;
end;
$$;


-- =====================================================================
-- 5. ВКЛЮЧИТЬ ROW LEVEL SECURITY
-- =====================================================================

alter table worlds enable row level security;
alter table world_members enable row level security;
alter table maps enable row level security;
alter table locations enable row level security;
alter table world_invites enable row level security;


-- =====================================================================
-- 6. RLS-ПОЛИТИКИ: worlds
-- =====================================================================

create policy "Members can view their worlds"
on worlds for select
using (is_world_member(id));

create policy "Authenticated users can create world"
on worlds for insert
with check (owner_id = auth.uid());

create policy "Owner can update their world"
on worlds for update
using (owner_id = auth.uid());

create policy "Owner can delete their world"
on worlds for delete
using (owner_id = auth.uid());


-- =====================================================================
-- 7. RLS-ПОЛИТИКИ: world_members
-- =====================================================================

create policy "Members can view membership of their worlds"
on world_members for select
using (is_world_member(world_id));

create policy "DM can manage members"
on world_members for all
using (is_world_dm(world_id))
with check (is_world_dm(world_id));


-- =====================================================================
-- 8. RLS-ПОЛИТИКИ: maps
-- =====================================================================

create policy "Members can view maps"
on maps for select
using (is_world_member(world_id));

create policy "DM can manage maps"
on maps for all
using (is_world_dm(world_id))
with check (is_world_dm(world_id));


-- =====================================================================
-- 9. RLS-ПОЛИТИКИ: locations (ключевая логика видимости для игроков)
-- =====================================================================

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

create policy "DM can manage locations"
on locations for all
using (
  exists (select 1 from maps m where m.id = locations.map_id and is_world_dm(m.world_id))
)
with check (
  exists (select 1 from maps m where m.id = locations.map_id and is_world_dm(m.world_id))
);


-- =====================================================================
-- 10. RLS-ПОЛИТИКИ: world_invites
-- =====================================================================

create policy "DM can manage invites"
on world_invites for all
using (is_world_dm(world_id))
with check (is_world_dm(world_id));

-- Разрешаем любому авторизованному ИСКАТЬ инвайт по коду —
-- иначе redeem_invite() не сможет прочитать чужой ещё мир по коду
create policy "Authenticated users can look up invite by code"
on world_invites for select
using (auth.role() = 'authenticated');


-- =====================================================================
-- 11. REALTIME
-- =====================================================================

alter publication supabase_realtime add table locations;


-- =====================================================================
-- 12. STORAGE — бакет для картинок карт
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('map-images', 'map-images', true)
on conflict (id) do nothing;


-- =====================================================================
-- 13. STORAGE — RLS-политики
-- =====================================================================

-- SELECT открыт всем: бакет публичный, картинки карт не секретны,
-- к тому же это требуется технически (Storage делает RETURNING после
-- insert/update, для чего обязательно нужна select-политика)
create policy "Anyone can read map images"
on storage.objects for select
using (bucket_id = 'map-images');

create policy "DM can upload map images for their worlds"
on storage.objects for insert
with check (
  bucket_id = 'map-images'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);

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

create policy "DM can delete their map images"
on storage.objects for delete
using (
  bucket_id = 'map-images'
  and is_world_dm((storage.foldername(name))[1]::uuid)
);

-- =====================================================================
-- Конец. После выполнения — таблицы, функции, RLS и Storage готовы.
-- =====================================================================
