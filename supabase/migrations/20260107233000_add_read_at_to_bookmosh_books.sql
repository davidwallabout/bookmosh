alter table if exists public.bookmosh_books
  add column if not exists read_at timestamptz;

update public.bookmosh_books
set read_at = coalesce(read_at, updated_at, now())
where status = 'Read' and read_at is null;

create index if not exists bookmosh_books_owner_read_at_idx
  on public.bookmosh_books (owner, read_at desc);
