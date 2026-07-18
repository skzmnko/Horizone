-- =====================================================================
-- Trace & Place — расширение системы приглашений.
-- Идемпотентно, как и предыдущая миграция.
--
-- Добавляет:
--   1) лимит использований и авторство кода приглашения;
--   2) invited_email — задел на будущее (см. README-INVITES.md):
--      персональные приглашения, которые сами найдут пользователя
--      в его личном кабинете по email, без ручного ввода кода;
--   3) redeem_invite — теперь учитывает лимит использований и явно
--      требует авторизации;
--   4) get_invite_preview — единственная RPC, которую можно вызвать
--      АНОНИМНО (без логина). Отдаёт только название мира и имя DM —
--      этого достаточно, чтобы показать баннer "Тебя пригласили в
--      мир «Ораска»" на экране логина/регистрации, не раскрывая
--      ничего больше неавторизованному человеку.
-- =====================================================================

alter table world_invites add column if not exists max_uses integer;
alter table world_invites add column if not exists uses_count integer not null default 0;
alter table world_invites add column if not exists created_by uuid references auth.users(id);

-- Задел на будущее: персональное приглашение на конкретный email.
-- Пока не используется в текущем флоу (см. `redeem_invite`) — код
-- работает как обычный, невзирая на это поле. Когда будет сделан
-- личный кабинет с входящими приглашениями, здесь же можно будет
-- матчить их по email пользователя без изменения структуры таблицы.
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

  -- Если пользователь уже состоит в мире (повторно перешёл по той же
  -- ссылке) — просто возвращаем world_id, не трогая лимит использований
  -- и не перезаписывая уже выбранное имя персонажа.
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

-- Публичный (анонимный) предпросмотр приглашения — по коду отдаёт
-- только название мира и имя мастера, без доступа к самим данным мира.
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

-- Список активных приглашений мира — для DM-панели ("мои коды
-- приглашений" со статусом использования и возможностью отозвать).
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
-- Конец.
-- =====================================================================
