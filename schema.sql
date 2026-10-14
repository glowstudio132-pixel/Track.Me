-- Track Me: accounts, profiles, coins, daily streak and badges.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins int not null default 0,
  streak int not null default 0,
  last_checkin date
);
create table if not exists public.user_badges (
  user_id uuid references auth.users(id) on delete cascade,
  badge text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);

alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.user_badges enable row level security;

-- Anyone signed in can look up profiles (needed later to find friends); only you can edit yours.
create policy "profiles are readable" on public.profiles for select to authenticated using (true);
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Coins, streaks and badges can only be READ by their owner. They change only through the functions below.
create policy "read own stats" on public.player_stats for select to authenticated using (user_id = auth.uid());
create policy "read own badges" on public.user_badges for select to authenticated using (user_id = auth.uid());

-- When someone signs up (Google or email), create their profile and stats automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, 'user'), '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  if length(base) < 3 then base := 'user'; end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, left(base, 12) || '_' || substr(md5(new.id::text), 1, 5),
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)));
  insert into public.player_stats (user_id) values (new.id);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Internal helper: give a badge once, and 20 coins for earning it. Not callable from the browser.
create or replace function public.award_badge(p_user uuid, p_badge text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.user_badges (user_id, badge) values (p_user, p_badge) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update public.player_stats set coins = coins + 20 where user_id = p_user; end if;
  return n > 0;
end $$;
revoke all on function public.award_badge(uuid, text) from public, anon, authenticated;

-- Daily check-in: +2 coins, extends your streak when you check in on consecutive days (UTC days).
create or replace function public.check_in() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s public.player_stats;
  today date := (now() at time zone 'utc')::date;
  new_streak int;
  got text[] := '{}';
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.player_stats (user_id) values (uid) on conflict do nothing;
  select * into s from public.player_stats where user_id = uid for update;
  if s.last_checkin = today then
    return jsonb_build_object('already', true, 'coins', s.coins, 'streak', s.streak, 'badges', '[]'::jsonb);
  end if;
  new_streak := case when s.last_checkin = today - 1 then s.streak + 1 else 1 end;
  update public.player_stats set streak = new_streak, last_checkin = today, coins = coins + 2 where user_id = uid;
  if public.award_badge(uid, 'first_checkin') then got := got || 'first_checkin'; end if;
  if new_streak >= 7 and public.award_badge(uid, 'daily_7') then got := got || 'daily_7'; end if;
  if new_streak >= 30 and public.award_badge(uid, 'daily_30') then got := got || 'daily_30'; end if;
  select * into s from public.player_stats where user_id = uid;
  return jsonb_build_object('already', false, 'coins', s.coins, 'streak', s.streak, 'badges', to_jsonb(got));
end $$;
grant execute on function public.check_in() to authenticated;
