-- Run once in your own Supabase project's SQL Editor. No secret keys are needed.
create table if not exists public.dashboard_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.dashboard_snapshots enable row level security;
drop policy if exists "Read own dashboard" on public.dashboard_snapshots;
create policy "Read own dashboard" on public.dashboard_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);

-- All writes go through the version-checked function below; browsers cannot
-- bypass conflict checks or read/write another user's rows.
revoke all on public.dashboard_snapshots from public, anon, authenticated;
grant select on public.dashboard_snapshots to authenticated;

create or replace function public.save_dashboard(expected_revision bigint, document jsonb)
returns table(payload jsonb, revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if expected_revision < 0 or expected_revision is null
     or document is null or document->>'version' is distinct from '1'
     or jsonb_typeof(document->'materials') is distinct from 'array'
     or jsonb_typeof(document->'logs') is distinct from 'array'
     or jsonb_typeof(document->'tasks') is distinct from 'array'
     or jsonb_typeof(document->'goals') is distinct from 'array' then
    raise exception 'Invalid dashboard document' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.dashboard_snapshots as d(user_id, payload)
      values (current_user_id, document)
      on conflict (user_id) do nothing;
  else
    update public.dashboard_snapshots as d
      set payload = document, revision = d.revision + 1, updated_at = now()
      where d.user_id = current_user_id and d.revision = expected_revision;
  end if;
  if not found then
    raise exception 'DASHBOARD_CONFLICT' using errcode = 'P0001';
  end if;
  return query select d.payload, d.revision, d.updated_at
    from public.dashboard_snapshots d where d.user_id = current_user_id;
end;
$$;
revoke all on function public.save_dashboard(bigint, jsonb) from public, anon;
grant execute on function public.save_dashboard(bigint, jsonb) to authenticated;
