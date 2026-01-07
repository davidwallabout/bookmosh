alter table if exists public.bookmosh_books
  add column if not exists status_updated_at timestamptz;

update public.bookmosh_books
set status_updated_at = coalesce(status_updated_at, updated_at, now())
where status_updated_at is null;

create index if not exists bookmosh_books_owner_status_updated_at_idx
  on public.bookmosh_books (owner, status_updated_at desc);
