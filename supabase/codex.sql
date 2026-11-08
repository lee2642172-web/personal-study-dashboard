-- Run once after setup.sql. Existing dashboard data and policies are untouched.
begin;
create table if not exists public.dashboard_chat_connections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  sealed_session text not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '365 days',
  revoked_at timestamptz
);
alter table public.dashboard_chat_connections enable row level security;
revoke all on public.dashboard_chat_connections from public, anon, authenticated;
grant select(id,user_id,label,created_at,expires_at,revoked_at) on public.dashboard_chat_connections to authenticated;
drop policy if exists "Read own Codex connections" on public.dashboard_chat_connections;
create policy "Read own Codex connections" on public.dashboard_chat_connections for select to authenticated using ((select auth.uid())=user_id);

create or replace function public.create_dashboard_chat_connection(connection uuid, label text, digest text, sealed text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if char_length(label) not between 1 and 80 or digest !~ '^[a-f0-9]{64}$' or sealed not like 'v1.%' or char_length(sealed)>50000 then
    raise exception 'Invalid connection' using errcode='22023';
  end if;
  insert into public.dashboard_chat_connections(id,user_id,label,token_hash,sealed_session) values(connection,auth.uid(),label,digest,sealed);
end $$;
-- These capability functions return only encrypted credentials; even a valid key
-- never exposes a Supabase access/refresh token without the server encryption key.
create or replace function public.resolve_dashboard_chat_connection(digest text)
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('id',c.id,'user_id',c.user_id,'sealed_session',c.sealed_session,'revision',c.revision,'expires_at',c.expires_at)
  from public.dashboard_chat_connections c where c.token_hash=digest and c.revoked_at is null and c.expires_at>now();
$$;
create or replace function public.refresh_dashboard_chat_connection(digest text, expected_revision bigint, sealed text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if sealed not like 'v1.%' or char_length(sealed)>50000 then return false; end if;
  update public.dashboard_chat_connections c set sealed_session=sealed,revision=c.revision+1
    where c.token_hash=digest and c.revision=expected_revision and c.revoked_at is null and c.expires_at>now();
  return found;
end $$;
create or replace function public.revoke_dashboard_chat_connection(connection uuid)
returns void language sql security definer set search_path='' as $$
  update public.dashboard_chat_connections c set revoked_at=now(),sealed_session='revoked' where c.id=connection and c.user_id=(select auth.uid());
$$;
revoke all on function public.create_dashboard_chat_connection(uuid,text,text,text), public.resolve_dashboard_chat_connection(text), public.refresh_dashboard_chat_connection(text,bigint,text), public.revoke_dashboard_chat_connection(uuid) from public, anon, authenticated;
grant execute on function public.resolve_dashboard_chat_connection(text), public.refresh_dashboard_chat_connection(text,bigint,text) to anon, authenticated;
grant execute on function public.create_dashboard_chat_connection(uuid,text,text,text), public.revoke_dashboard_chat_connection(uuid) to authenticated;

commit;
