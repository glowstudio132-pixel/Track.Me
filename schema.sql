-- Track Me database setup: accounts, profiles, coins, streaks, badges, friends and chat.
-- Run in the Supabase dashboard: SQL Editor > New query > paste > Run. It is safe to run again.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins int not null default 0 check (coins >= 0),
  streak int not null default 0,
  last_checkin date
);
create table if not exists public.user_badges (
  user_id uuid references auth.users(id) on delete cascade,
  badge text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users(id) on delete cascade,
  receiver uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'spot')),
  body text not null default '' check (length(body) <= 500),
  spot jsonb,
  coins int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists messages_pair_time on public.messages (sender, receiver, created_at);
create table if not exists public.streaks (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  count int not null default 0,
  last_day date,
  a_day date,
  b_day date,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.user_badges enable row level security;
alter table public.friendships enable row level security;
alter table public.messages enable row level security;
alter table public.streaks enable row level security;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships f where f.status = 'accepted'
    and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$$;

-- Browsers can READ their own data and write only what is listed here.
-- Coins, streaks and badges change only through the functions further down.
drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles for select to authenticated using (true);
drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "read own stats" on public.player_stats;
create policy "read own stats" on public.player_stats for select to authenticated using (user_id = auth.uid());
drop policy if exists "read own badges" on public.user_badges;
create policy "read own badges" on public.user_badges for select to authenticated using (user_id = auth.uid());
drop policy if exists "see my friendships" on public.friendships;
create policy "see my friendships" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "send friend request" on public.friendships;
create policy "send friend request" on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
drop policy if exists "remove friendship" on public.friendships;
create policy "remove friendship" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "read my messages" on public.messages;
create policy "read my messages" on public.messages for select to authenticated using (auth.uid() in (sender, receiver));
drop policy if exists "send text to friends" on public.messages;
create policy "send text to friends" on public.messages for insert to authenticated
  with check (kind = 'text' and sender = auth.uid() and coins = 0 and spot is null and public.are_friends(auth.uid(), receiver));
drop policy if exists "read my streaks" on public.streaks;
create policy "read my streaks" on public.streaks for select to authenticated using (auth.uid() in (user_a, user_b));

-- New sign-ups (Google or email) get a profile and stats automatically.
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
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Internal helper: give a badge once (and 20 coins for it). Not callable from the browser.
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

-- Daily check-in: +2 coins; consecutive UTC days grow your streak.
create or replace function public.check_in() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s public.player_stats;
  today date := (now() at time zone 'utc')::date;
  new_streak int; ok boolean; got text[] := '{}';
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.player_stats (user_id) values (uid) on conflict do nothing;
  select * into s from public.player_stats where user_id = uid for update;
  if s.last_checkin = today then
    return jsonb_build_object('already', true, 'coins', s.coins, 'streak', s.streak, 'badges', '[]'::jsonb);
  end if;
  new_streak := case when s.last_checkin = today - 1 then s.streak + 1 else 1 end;
  update public.player_stats set streak = new_streak, last_checkin = today, coins = coins + 2 where user_id = uid;
  ok := public.award_badge(uid, 'first_checkin'); if ok then got := got || 'first_checkin'; end if;
  if new_streak >= 7 then ok := public.award_badge(uid, 'daily_7'); if ok then got := got || 'daily_7'; end if; end if;
  if new_streak >= 30 then ok := public.award_badge(uid, 'daily_30'); if ok then got := got || 'daily_30'; end if; end if;
  select * into s from public.player_stats where user_id = uid;
  return jsonb_build_object('already', false, 'coins', s.coins, 'streak', s.streak, 'badges', to_jsonb(got));
end $$;
revoke all on function public.check_in() from public, anon;
grant execute on function public.check_in() to authenticated;

-- Accept or decline a friend request addressed to you.
create or replace function public.respond_friend(p_id bigint, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted' where id = p_id and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships where id = p_id and addressee = auth.uid() and status = 'pending';
  end if;
end $$;
revoke all on function public.respond_friend(bigint, boolean) from public, anon;
grant execute on function public.respond_friend(bigint, boolean) to authenticated;

-- Send a spot to a friend: stores the message, pays coins, optionally gifts coins, and grows the pair streak
-- when BOTH of you have sent a spot on the same UTC day.
create or replace function public.send_spot(p_receiver uuid, p_body text, p_spot jsonb, p_coins int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  a uuid; b uuid; u uuid; st public.streaks;
  lat numeric; lng numeric; gift int := coalesce(p_coins, 0);
  sent_today int; total int; earned int := 0; grew boolean := false; ok boolean; got text[] := '{}';
begin
  if uid is null then raise exception 'not signed in'; end if;
  if uid = p_receiver or not public.are_friends(uid, p_receiver) then raise exception 'you can only send spots to friends'; end if;
  if length(coalesce(p_body, '')) > 500 then raise exception 'message too long'; end if;
  begin
    lat := (p_spot->>'lat')::numeric; lng := (p_spot->>'lng')::numeric;
  exception when others then
    raise exception 'bad location';
  end;
  if lat is null or lng is null or lat < -90 or lat > 90 or lng < -180 or lng > 180 then raise exception 'bad location'; end if;
  if gift < 0 or gift > 1000 then raise exception 'bad coin amount'; end if;
  select count(*) into sent_today from public.messages
    where sender = uid and kind = 'spot' and (created_at at time zone 'utc')::date = today;
  if sent_today >= 100 then raise exception 'daily limit reached'; end if;

  insert into public.player_stats (user_id) values (uid) on conflict do nothing;
  insert into public.player_stats (user_id) values (p_receiver) on conflict do nothing;
  if gift > 0 then
    update public.player_stats set coins = coins - gift where user_id = uid and coins >= gift;
    if not found then raise exception 'not enough coins'; end if;
    update public.player_stats set coins = coins + gift where user_id = p_receiver;
    ok := public.award_badge(uid, 'generous'); if ok then got := got || 'generous'; end if;
  end if;

  insert into public.messages (sender, receiver, kind, body, spot, coins)
  values (uid, p_receiver, 'spot', coalesce(p_body, ''), p_spot, gift);
  if sent_today < 3 then
    earned := 5;
    update public.player_stats set coins = coins + 5 where user_id = uid;
  end if;
  select count(*) into total from public.messages where sender = uid and kind = 'spot';
  ok := public.award_badge(uid, 'first_spot'); if ok then got := got || 'first_spot'; end if;
  if total >= 10 then ok := public.award_badge(uid, 'spots_10'); if ok then got := got || 'spots_10'; end if; end if;

  a := least(uid, p_receiver); b := greatest(uid, p_receiver);
  insert into public.streaks (user_a, user_b) values (a, b) on conflict do nothing;
  select * into st from public.streaks where user_a = a and user_b = b for update;
  if uid = a then st.a_day := today; else st.b_day := today; end if;
  if st.a_day = today and st.b_day = today and (st.last_day is null or st.last_day < today) then
    st.count := case when st.last_day = today - 1 then st.count + 1 else 1 end;
    st.last_day := today;
    grew := true;
  end if;
  update public.streaks set count = st.count, last_day = st.last_day, a_day = st.a_day, b_day = st.b_day
    where user_a = a and user_b = b;
  if grew then
    update public.player_stats set coins = coins + 10 where user_id in (a, b);
    foreach u in array array[a, b] loop
      if st.count >= 3 then ok := public.award_badge(u, 'streak_3'); if ok and u = uid then got := got || 'streak_3'; end if; end if;
      if st.count >= 7 then ok := public.award_badge(u, 'streak_7'); if ok and u = uid then got := got || 'streak_7'; end if; end if;
      if st.count >= 30 then ok := public.award_badge(u, 'streak_30'); if ok and u = uid then got := got || 'streak_30'; end if; end if;
    end loop;
  end if;
  return jsonb_build_object('earned', earned, 'streak', st.count, 'grew', grew, 'badges', to_jsonb(got));
end $$;
revoke all on function public.send_spot(uuid, text, jsonb, int) from public, anon;
grant execute on function public.send_spot(uuid, text, jsonb, int) to authenticated;

-- Live chat: let the browser hear about new messages.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
