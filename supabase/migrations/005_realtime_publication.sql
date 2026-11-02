-- =====================================================================
-- Wasel migration 005 — make sure every live table is published to Supabase Realtime
-- schema.sql added them in one statement that silently did nothing if any table was already published.
-- This adds each table on its own. Safe to re-run. Run in Supabase → SQL Editor.
-- =====================================================================
do $$
declare t text;
begin
  if not exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if (select puballtables from pg_publication where pubname = 'supabase_realtime') then
    return;   -- publication already covers every table
  end if;
  foreach t in array array['wasel_shipments','wasel_shipment_offers','wasel_shipment_events','wasel_couriers',
                           'wasel_courier_locations','wasel_notifications','wasel_business_members'] loop
    if to_regclass('public.' || t) is not null and not exists(
         select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Check: should list 7 tables (or "all tables")
select coalesce(string_agg(tablename, ', ' order by tablename), 'all tables') as realtime_tables
from pg_publication_tables where pubname = 'supabase_realtime' and tablename like 'wasel_%';
