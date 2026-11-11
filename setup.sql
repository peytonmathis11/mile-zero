-- Run once in Supabase Dashboard > SQL Editor.
-- Private single-record-per-user training plan storage (beta).
create table if not exists public.runner_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.runner_data enable row level security;
revoke all on public.runner_data from anon, authenticated;
grant select, insert, update, delete on public.runner_data to authenticated;

drop policy if exists "runner_data_select_own" on public.runner_data;
create policy "runner_data_select_own" on public.runner_data for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "runner_data_insert_own" on public.runner_data;
create policy "runner_data_insert_own" on public.runner_data for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "runner_data_update_own" on public.runner_data;
create policy "runner_data_update_own" on public.runner_data for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "runner_data_delete_own" on public.runner_data;
create policy "runner_data_delete_own" on public.runner_data for delete to authenticated
using ((select auth.uid()) = user_id);
