-- Applied to project dulmdmzaivhspxbdlmnr via the Supabase MCP server
-- (version 20261027190822). This file is the record; don't edit it after the fact.

-- Diary entries: one row per logged film, owned by one Clerk user.
create table public.entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null default (auth.jwt()->>'sub'),
  title        text not null check (btrim(title) <> '' and char_length(title) <= 120),
  watched_on   date not null,
  rating       smallint not null check (rating between 1 and 5),
  reflection   text not null default '' check (char_length(reflection) <= 500),
  itunes_id    bigint,
  artwork_url  text,
  release_year smallint,
  created_at   timestamptz not null default now()
);

create index entries_user_watched_idx on public.entries (user_id, watched_on desc);

-- ensure_rls already enables RLS on new public tables; stated here so the
-- migration doesn't depend on that trigger.
alter table public.entries enable row level security;

-- Grants: signed-out users get nothing; signed-in users get exactly the four
-- operations the policies cover. TRUNCATE ignores RLS, so nobody gets it.
-- Updates may not touch id, user_id or created_at.
revoke all on table public.entries from anon, authenticated;
grant select, insert, delete on table public.entries to authenticated;
grant update (title, watched_on, rating, reflection, itunes_id, artwork_url, release_year)
  on table public.entries to authenticated;

create policy "Read own entries" on public.entries
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "Create own entries" on public.entries
  for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "Update own entries" on public.entries
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "Delete own entries" on public.entries
  for delete to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

-- Event-trigger function; it never needs to be callable through the API.
-- Event triggers don't check EXECUTE when they fire, so ensure_rls keeps working.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
