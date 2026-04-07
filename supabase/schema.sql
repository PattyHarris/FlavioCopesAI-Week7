create extension if not exists pgcrypto;

create table if not exists bookmarks (
  recipe_id text primary key,
  recipe jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists search_history (
  id text primary key,
  ingredients text[] not null,
  cached boolean not null default false,
  recipes jsonb not null,
  created_at timestamptz not null default now()
);

alter table bookmarks enable row level security;
alter table search_history enable row level security;

drop policy if exists "No direct client access to bookmarks" on bookmarks;
create policy "No direct client access to bookmarks"
on bookmarks
for all
to public
using (false)
with check (false);

drop policy if exists "No direct client access to search_history" on search_history;
create policy "No direct client access to search_history"
on search_history
for all
to public
using (false)
with check (false);
