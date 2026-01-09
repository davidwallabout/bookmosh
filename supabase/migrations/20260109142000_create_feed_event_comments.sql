create extension if not exists pgcrypto;

-- Comments on a feed event (used when there is no underlying review row yet)
create table if not exists public.feed_event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.book_events(id) on delete cascade,
  commenter_id uuid not null,
  commenter_username text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists feed_event_comments_event_id_created_at_idx
  on public.feed_event_comments (event_id, created_at asc);

alter table public.feed_event_comments disable row level security;
