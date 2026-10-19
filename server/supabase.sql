-- Vanguard Deck Lab — accounts database (Supabase). Paste all of this into Supabase → SQL Editor → New query → Run. Safe to run again.

-- player profile: one per account, made automatically on sign-up
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 16),
  tag text unique not null,                     -- friend code, e.g. K7Q2MX
  created_at timestamptz not null default now()
);
-- saved decks (same packed form the game keeps on the computer)
create table if not exists public.decks (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null check (char_length(id) <= 64),
  data jsonb not null,
  deleted boolean not null default false,
  updated_at bigint not null default 0,         -- game clock (ms) of the last change
  primary key (owner, id)
);
-- match history
create table if not exists public.matches (
  id bigint generated always as identity primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  played_at timestamptz not null default now(),
  mode text not null check (mode in ('solo', 'bot', 'online')),
  my_deck text, opp_name text, opp_deck text,
  result text not null check (result in ('win', 'loss', 'draw')),
  turns int, reason text
);
create index if not exists matches_owner_time on public.matches (owner, played_at desc);
-- friends: a row means "owner added friend"; both rows = friends with each other
create table if not exists public.friends (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  friend uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, friend),
  check (owner <> friend)
);

alter table public.profiles enable row level security;
alter table public.decks enable row level security;
alter table public.matches enable row level security;
alter table public.friends enable row level security;

drop policy if exists "profiles readable by players" on public.profiles;
create policy "profiles readable by players" on public.profiles for select to authenticated using (true);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own decks" on public.decks;
create policy "own decks" on public.decks for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "own matches read" on public.matches;
create policy "own matches read" on public.matches for select to authenticated using (owner = auth.uid());
drop policy if exists "own matches add" on public.matches;
create policy "own matches add" on public.matches for insert to authenticated with check (owner = auth.uid());

drop policy if exists "friends read" on public.friends;
create policy "friends read" on public.friends for select to authenticated using (owner = auth.uid() or friend = auth.uid());
drop policy if exists "friends add" on public.friends;
create policy "friends add" on public.friends for insert to authenticated with check (owner = auth.uid());
drop policy if exists "friends remove" on public.friends;
create policy "friends remove" on public.friends for delete to authenticated using (owner = auth.uid());

-- the profile is made when the account is made (name from the sign-up form, random friend code)
create or replace function public.vg_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare t text; n text;
begin
  n := left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)), 16);
  loop
    t := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 6));
    exit when char_length(t) = 6 and not exists (select 1 from public.profiles where tag = t);
  end loop;
  insert into public.profiles (id, name, tag) values (new.id, n, t);
  return new;
end $$;
drop trigger if exists vg_on_new_user on auth.users;
create trigger vg_on_new_user after insert on auth.users for each row execute function public.vg_new_user();
-- accounts made before this script ran get a profile too
insert into public.profiles (id, name, tag)
  select u.id, left(coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)), 16), upper(substr(md5(u.id::text), 1, 6))
  from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);
