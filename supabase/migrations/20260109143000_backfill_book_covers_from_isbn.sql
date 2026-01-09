-- Backfill missing book covers using OpenLibrary ISBN cover URLs
-- Safe: only updates rows where cover is null/empty and isbn is present.

update public.bookmosh_books
set cover = 'https://covers.openlibrary.org/b/isbn/' || trim(isbn) || '-M.jpg'
where (cover is null or trim(cover) = '')
  and isbn is not null
  and trim(isbn) <> '';
