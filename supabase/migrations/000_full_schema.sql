-- =====================================================================
-- Trace & Place — полное развёртывание БД с нуля.
-- Идемпотентно: безопасно выполнять повторно на базе, где схема уже
-- создана (например, при автоматическом прогоне миграций из git) —
-- ничего не упадёт с ошибкой "already exists".
-- =====================================================================


-- =====================================================================
-- 1. РАСШИРЕНИЯ
-- =====================================================================
create extension if not exists "pgcrypto";


-- =====================================================================
-- 2. ТАБЛИЦЫ
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

-- Публичный профиль пользователя. Отдельно от auth.users, потому что:
-- 1) auth.users недоступна напрямую для запросов с клиента;
-- 2) display_name должен быть уникальным — а user_metadata для этого
--    не подходит (её как раз может свободно менять сам пользователь).
create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null unique,
    created_at timestamptz default now()
);

-- Отдельное отображаемое имя (имя персонажа) конкретно в этом мире —
-- если не задано, используется profiles.display_name.
alter table world_members add column if not exists display_name text;

-- На случай если worlds/world_members были созданы раньше без этих колонок
alter table worlds add column if not exists cover_image_path text;


-- =====================================================================
-- 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (create or replace — уже идемпотентно)
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
-- 4. RPC-ФУНКЦИИ
-- =====================================================================

-- Создание мира: сам мир + мастер как участник.
-- Карта НЕ создаётся автоматически — DM создаёт её явно при загрузке
-- картинки, чтобы в базе не оставалось "пустых" карт без изображения.
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

-- Игрок может в любой момент сменить своё отображаемое имя (имя
-- персонажа) конкретно в этом мире. Отдельная RPC вместо общей UPDATE
-- политики — чтобы игрок физически не мог этим же путём поменять
-- себе роль или world_id, только свою подпись.
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

-- Автоматическое создание профиля сразу при регистрации пользователя.
-- Имя берём из user_metadata (передаётся при signUp), либо из email.
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

-- Бэкафилл: у пользователей, созданных ДО появления триггера (например,
-- тестовых аккаунтов из Dashboard), профиля ещё нет — досоздаём.
-- Если у кого-то из них случайно совпадут имена по умолчанию — этот
-- insert упадёт на unique-констрейнте; в норме для пары тестовых
-- аккаунтов такого не бывает.
insert into public.profiles (id, display_name)
select id, coalesce(nullif(raw_user_meta_data->>'display_name', ''), split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- Проверка занятости display_name (используется на форме регистрации
-- ещё до отправки — это подсказка для UX, а не единственная защита:
-- финальную уникальность всё равно обеспечивает "unique" на колонке)
create or replace function is_display_name_available(_name text)
returns boolean
language sql
stable
as $$
  select not exists (select 1 from profiles where display_name = _name);
$$;


-- =====================================================================
-- 5. ВКЛЮЧИТЬ ROW LEVEL SECURITY (идемпотентно само по себе)
-- =====================================================================

alter table worlds enable row level security;
alter table world_members enable row level security;
alter table maps enable row level security;
alter table locations enable row level security;
alter table world_invites enable row level security;
alter table profiles enable row level security;


-- =====================================================================
-- 6-10. RLS-ПОЛИТИКИ
-- Паттерн "drop if exists + create" делает создание политик идемпотентным
-- (обычный "create policy" падает с ошибкой, если политика с таким
-- именем уже есть).
-- =====================================================================

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


drop policy if exists "Members can view membership of their worlds" on world_members;
create policy "Members can view membership of their worlds"
on world_members for select
using (is_world_member(world_id));

drop policy if exists "DM can manage members" on world_members;
create policy "DM can manage members"
on world_members for all
using (is_world_dm(world_id))
with check (is_world_dm(world_id));


drop policy if exists "Members can view maps" on maps;
create policy "Members can view maps"
on maps for select
using (is_world_member(world_id));

drop policy if exists "DM can manage maps" on maps;
create policy "DM can manage maps"
on maps for all
using (is_world_dm(world_id))
with check (is_world_dm(world_id));


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


drop policy if exists "DM can manage invites" on world_invites;
create policy "DM can manage invites"
on world_invites for all
using (is_world_dm(world_id))
with check (is_world_dm(world_id));

drop policy if exists "Authenticated users can look up invite by code" on world_invites;
create policy "Authenticated users can look up invite by code"
on world_invites for select
using (auth.role() = 'authenticated');


-- Профили: имя видно всем авторизованным (нужно, чтобы показывать
-- участников мира по именам), редактировать может только сам пользователь.
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
-- "alter publication ... add table" падает с ошибкой, если таблица уже
-- в публикации — оборачиваем в проверку через pg_publication_tables.
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
-- 12. STORAGE — бакеты
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('map-images', 'map-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('world-covers', 'world-covers', true)
on conflict (id) do nothing;


-- =====================================================================
-- 13. STORAGE — RLS-политики
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
-- Конец.
-- =====================================================================