-- Grants Supabase applies after the auth service has migrated its schema.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
-- storage schema stub so migrations that create buckets/policies run unchanged locally
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner uuid, metadata jsonb, created_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as
$$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
