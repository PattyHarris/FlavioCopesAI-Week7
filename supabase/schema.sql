create extension if not exists pgcrypto;

drop policy if exists "Public recipe image reads" on storage.objects;

drop table if exists bookmarks cascade;
drop table if exists search_history cascade;
drop table if exists recipe_cache cascade;
drop table if exists recipe_images cascade;

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null,
  recipe jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create table search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ingredient_key text not null,
  ingredients text[] not null,
  cached boolean not null default false,
  recipes jsonb not null,
  search_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ingredient_key)
);

create table recipe_cache (
  ingredient_key text primary key,
  ingredients text[] not null,
  recipes jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recipe_images (
  image_key text primary key,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do update
set public = excluded.public;

alter table bookmarks enable row level security;
alter table search_history enable row level security;
alter table recipe_cache enable row level security;
alter table recipe_images enable row level security;

create policy "Users manage their own bookmarks"
on bookmarks
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage their own search history"
on search_history
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Authenticated users can read recipe cache"
on recipe_cache
for select
to authenticated
using (true);

create policy "No direct writes to recipe cache"
on recipe_cache
for all
to public
using (false)
with check (false);

create policy "Authenticated users can read recipe images"
on recipe_images
for select
to authenticated
using (true);

create policy "No direct writes to recipe images"
on recipe_images
for all
to public
using (false)
with check (false);

create policy "Public recipe image reads"
on storage.objects
for select
to public
using (bucket_id = 'recipe-images');
