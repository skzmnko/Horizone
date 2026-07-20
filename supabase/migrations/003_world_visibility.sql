-- =====================================================================
-- Публичные миры.
--
-- 1.1: по умолчанию мир приватный (is_public = false) и виден только
--      своему владельцу — этому ничего дополнительно делать не нужно,
--      так как is_world_member() уже включает владельца (create_world()
--      сразу добавляет его в world_members с ролью 'dm').
-- 1.2: если владелец делает мир публичным, он должен стать виден
--      ВСЕМ зарегистрированным (authenticated) пользователям — не
--      только участникам. Это только про строку самого мира
--      (название, обложка) — доступ к картам и локациям внутри мира
--      по-прежнему регулируется отдельными политиками и остаётся
--      только у участников (world_members), is_public на них не влияет.
-- =====================================================================

alter table worlds add column if not exists is_public boolean not null default false;

drop policy if exists "Members can view their worlds" on worlds;
drop policy if exists "Users can view accessible worlds" on worlds;
create policy "Users can view accessible worlds"
on worlds for select
using (is_world_member(id) or is_public = true);

-- Политики insert/update/delete не меняются: "Owner can update their world"
-- уже разрешает владельцу (owner_id = auth.uid()) менять любые поля
-- своего мира, включая is_public.
