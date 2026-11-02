-- Couriers receive deliveries reliably (migration 004): late online, no GPS fix, widening without pg_cron.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.uid', coalesce(p::text, ''), false); end $$;
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end $$;
grant all on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
set client_min_messages = notice;
reset role;
insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000020a1','tlv-shop@test','{"app":"wasel","role":"business","full_name":"TLV Shop","business_name":"TLV Shop"}'),
 ('00000000-0000-0000-0000-0000000020c1','late@test','{"app":"wasel","role":"courier","full_name":"Late Courier","vehicle":"motorcycle"}'),
 ('00000000-0000-0000-0000-0000000020c2','far@test','{"app":"wasel","role":"courier","full_name":"Far Courier","vehicle":"motorcycle"}');
update wasel_businesses set lat = 32.0775, lng = 34.7745, address = 'Dizengoff 50' where owner_id = '00000000-0000-0000-0000-0000000020a1';
-- both approved; "late" is offline and has an old position ~5 km away; "far" is in Haifa (90 km)
update wasel_couriers set verification = 'approved', is_online = false, lat = 32.12, lng = 34.785, last_seen_at = now() - interval '1 hour'
 where id = '00000000-0000-0000-0000-0000000020c1';
update wasel_couriers set verification = 'approved', is_online = true, lat = 32.81, lng = 34.99, last_seen_at = now()
 where id = '00000000-0000-0000-0000-0000000020c2';
-- make other suites' couriers irrelevant
update wasel_couriers set is_online = false where id not in ('00000000-0000-0000-0000-0000000020c1','00000000-0000-0000-0000-0000000020c2');

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000020a1');
insert into wasel_shipments(business_id, sender_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone)
select id, auth.uid(), 'Dizengoff 50', 32.0775, 34.7745, 'Rothschild 22', 32.0636, 34.7747, 'Noa', '052' from wasel_businesses where owner_id = auth.uid();
select pg_temp.ok(wasel_dispatch_shipment((select id from wasel_shipments where sender_id = auth.uid())) = 0, 'nobody nearby online at posting time');

-- courier comes online later, browser has no GPS fix yet (heartbeat without coordinates)
select pg_temp.as_user('00000000-0000-0000-0000-0000000020c1');
update wasel_couriers set is_online = true where id = auth.uid();
select pg_temp.ok((wasel_courier_heartbeat()->>'has_location')::boolean, 'heartbeat without GPS keeps the last known position');
reset role;   -- simulate the sender's screen being closed for a while: rounds are due
update wasel_shipments set last_dispatch_at = now() - interval '5 minutes' where sender_id = '00000000-0000-0000-0000-0000000020a1';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000020c1');
select wasel_courier_heartbeat();   -- radius 3 → 6 km
reset role;
select pg_temp.ok((select dispatch_radius_km from wasel_shipments where sender_id = '00000000-0000-0000-0000-0000000020a1') > 3,
  'courier heartbeat widens the search radius (no pg_cron needed)');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000020c1');
select wasel_courier_heartbeat();
select pg_temp.ok(exists(select 1 from wasel_shipment_offers where courier_id = auth.uid() and status = 'pending'),
  'courier who came online late receives the waiting delivery');
select pg_temp.ok(exists(select 1 from wasel_notifications where user_id = auth.uid() and title = 'new_offer'), 'and gets a notification');
select pg_temp.ok((select count(*) from wasel_shipment_offers where courier_id = auth.uid()) = 1, 'no duplicate offers on repeated heartbeats');
select pg_temp.ok((select status from wasel_accept_offer((select id from wasel_shipments where sender_id = '00000000-0000-0000-0000-0000000020a1'))) = 'accepted',
  'and can accept it');

select pg_temp.as_user('00000000-0000-0000-0000-0000000020c2');
select pg_temp.ok((wasel_courier_heartbeat()->>'waiting_nearby')::int = 0, 'courier 90 km away is told nothing is waiting nearby');
select pg_temp.ok(not exists(select 1 from wasel_shipment_offers where courier_id = auth.uid()), 'and receives no offer');
do $$ begin perform wasel__dispatch(gen_random_uuid()); raise exception 'FAIL: internal callable';
exception when insufficient_privilege then raise notice 'PASS: internal dispatch is not callable from the API'; end $$;
reset role;
\echo 'ALL COURIER DISPATCH TESTS PASSED'
