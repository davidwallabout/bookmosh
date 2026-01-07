create extension if not exists pgcrypto;

-- Multiple reviews per book
create table if not exists public.book_reviews (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.bookmosh_books(id) on delete cascade,
  owner_id uuid not null,
  owner_username text not null,
  book_title text not null,
  book_author text,
  book_cover text,
  body text not null,
  spoiler_warning boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists book_reviews_book_id_created_at_idx
  on public.book_reviews (book_id, created_at desc);

create index if not exists book_reviews_owner_id_created_at_idx
  on public.book_reviews (owner_id, created_at desc);

alter table public.book_reviews disable row level security;

-- Comments on a review (new multi-review model)
create table if not exists public.book_review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.book_reviews(id) on delete cascade,
  commenter_id uuid not null,
  commenter_username text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists book_review_comments_review_id_created_at_idx
  on public.book_review_comments (review_id, created_at asc);

alter table public.book_review_comments disable row level security;

-- Likes for a review (new multi-review model)
create table if not exists public.book_review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.book_reviews(id) on delete cascade,
  user_id uuid not null,
  username text not null,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create index if not exists book_review_likes_review_id_idx
  on public.book_review_likes (review_id);

alter table public.book_review_likes disable row level security;

-- Link activity events to a specific review (optional)
alter table public.book_events
  add column if not exists review_id uuid;

create index if not exists book_events_review_id_idx
  on public.book_events (review_id);
