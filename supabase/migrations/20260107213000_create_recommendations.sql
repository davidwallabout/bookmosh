create extension if not exists pgcrypto;

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  sender_username text not null,
  recipient_id uuid not null,
  recipient_username text not null,
  book_title text not null,
  book_author text,
  book_cover text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists recommendations_sender_id_created_at_idx
  on public.recommendations (sender_id, created_at desc);

create index if not exists recommendations_recipient_id_created_at_idx
  on public.recommendations (recipient_id, created_at desc);

alter table public.recommendations enable row level security;

drop policy if exists "recommendations_select_own" on public.recommendations;
create policy "recommendations_select_own"
on public.recommendations
for select
using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "recommendations_insert_sender" on public.recommendations;
create policy "recommendations_insert_sender"
on public.recommendations
for insert
with check (auth.uid() = sender_id);
