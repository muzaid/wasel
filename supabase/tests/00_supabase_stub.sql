-- Minimal stand-in for Supabase's auth / storage / realtime so the schema can be tested on plain PostgreSQL.
-- NEVER run this file on a real Supabase project.
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key, name text, public bool);
create table if not exists storage.objects(id serial, bucket_id text, name text);
create or replace function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
alter table storage.objects enable row level security;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant usage on sequences to authenticated;
