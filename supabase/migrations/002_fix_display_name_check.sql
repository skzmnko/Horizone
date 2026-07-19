-- =====================================================================
-- Fix: is_display_name_available всегда возвращала true для
-- анонимного вызывающего (то есть именно во время регистрации —
-- ровно тогда, когда её вызывают).
--
-- Причина: у функции не было `security definer`, поэтому она
-- выполнялась с правами вызывающего (security invoker). RLS-политика
-- на profiles ("Anyone authenticated can view profiles") пускает
-- только authenticated-роль — а на форме регистрации пользователь ещё
-- анонимен (anon). RLS молча скрывала вообще все строки profiles,
-- поэтому `select 1 from profiles where display_name = _name` не
-- находил НИЧЕГО, и `not exists(...)` всегда была true — независимо
-- от того, занято имя на самом деле или нет.
--
-- Из-за этого проверка на фронтенде (checkDisplayNameAvailable) молча
-- пропускала дальше даже реально занятые имена, и настоящий конфликт
-- всплывал только на самом signUp() — уже в виде generic-ошибки
-- Supabase Auth ("Database error saving new user"), которую сложно
-- надёжно отличить от любой другой ошибки триггера по тексту.
--
-- Все остальные RPC в проекте (redeem_invite, create_world,
-- set_my_world_display_name, delete_my_account, get_invite_preview,
-- get_world_invites...) уже были security definer — эта функция
-- единственная выпала.
-- =====================================================================

create or replace function is_display_name_available(_name text)
returns boolean
language sql
security definer
stable
as $$
  select not exists (select 1 from profiles where display_name = _name);
$$;
