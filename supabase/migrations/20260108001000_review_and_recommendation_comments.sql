create extension if not exists pgcrypto;

-- Comments on a user's review for a book (review is stored on bookmosh_books.review)
create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.bookmosh_books(id) on delete cascade,
  commenter_id uuid not null,
  commenter_username text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists review_comments_review_id_created_at_idx
  on public.review_comments (review_id, created_at asc);

alter table public.review_comments disable row level security;

-- Likes for a user's review
create table if not exists public.review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.bookmosh_books(id) on delete cascade,
  user_id uuid not null,
  username text not null,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create index if not exists review_likes_review_id_idx
  on public.review_likes (review_id);

alter table public.review_likes disable row level security;

-- Comments on a recommendation
create table if not exists public.recommendation_comments (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  commenter_id uuid not null,
  commenter_username text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_comments_recommendation_id_created_at_idx
  on public.recommendation_comments (recommendation_id, created_at asc);

alter table public.recommendation_comments disable row level security;
