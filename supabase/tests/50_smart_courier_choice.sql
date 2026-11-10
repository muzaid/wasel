-- Smart courier choice (migration 008): two customers want the same courier.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.uid', coalesce(p::text, ''), false); end $$;
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end $$;
create or replace function pg_temp.ship(p_sender uuid, p_mode text default 'next_best') returns uuid language plpgsql as $$
declare i uuid;
begin
  insert into wasel_shipments(sender_id, dispatch_mode, fallback_mode, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
    recipient_name, recipient_phone, vehicle, max_auto_price, direct_attempts)
  values (p_sender, 'direct', p_mode, 'Dizengoff 50', 32.0775, 34.7745, 'Rothschild 22', 32.0636, 34.7747, 'Noa', '052', 'motorcycle', 999, 7)
  returning id into i;
  return i;
end $$;
grant all on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
set client_min_messages = notice;
reset role;
update wasel_couriers set is_online = false;   -- isolate from the other suites
insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000050a1','a50@test','{"app":"wasel","role":"customer","full_name":"Amal A"}'),
 ('00000000-0000-0000-0000-0000000050a2','b50@test','{"app":"wasel","role":"customer","full_name":"Bassam B"}'),
 ('00000000-0000-0000-0000-0000000050a3','c50@test','{"app":"wasel","role":"customer","full_name":"Chen C"}'),
 ('00000000-0000-0000-0000-0000000050a4','d50@test','{"app":"wasel","role":"customer","full_name":"Dina D"}'),
 ('00000000-0000-0000-0000-000000005001','x50@test','{"app":"wasel","role":"courier","full_name":"Xavi Moto","vehicle":"motorcycle"}'),
 ('00000000-0000-0000-0000-000000005002','y50@test','{"app":"wasel","role":"courier","full_name":"Yara Moto","vehicle":"motorcycle"}'),
 ('00000000-0000-0000-0000-000000005003','z50@test','{"app":"wasel","role":"courier","full_name":"Ziv Car","vehicle":"car"}'),
 ('00000000-0000-0000-0000-000000005004','w50@test','{"app":"wasel","role":"courier","full_name":"Wafa Moto","vehicle":"motorcycle"}');
update wasel_couriers set verification = 'approved', is_online = true, last_seen_at = now(), lat = v.lat, lng = v.lng
from (values ('00000000-0000-0000-0000-000000005001'::uuid, 32.0778, 34.7748),   -- X: right at the pickup
             ('00000000-0000-0000-0000-000000005002'::uuid, 32.0830, 34.7850),   -- Y: ~1.2 km
             ('00000000-0000-0000-0000-000000005003'::uuid, 32.0790, 34.7760),   -- Z: car, close (but pricier)
             ('00000000-0000-0000-0000-000000005004'::uuid, 32.0760, 34.7700)) v(id, lat, lng)   -- W: ~0.45 km
where wasel_couriers.id = v.id;

set role authenticated;
-- A picks X
select pg_temp.as_user('00000000-0000-0000-0000-0000000050a1');
select set_config('t.s1', pg_temp.ship(auth.uid())::text, false);
select pg_temp.ok((select direct_attempts = 0 and max_auto_price is null from wasel_shipments where id = current_setting('t.s1')::uuid),
  'the client cannot set the fallback counters or the price cap');
select pg_temp.ok((wasel_request_courier(current_setting('t.s1')::uuid, '00000000-0000-0000-0000-000000005001')->>'ok')::boolean, 'A gets courier X');
select set_config('t.moto', (select price::text from wasel_shipments where id = current_setting('t.s1')::uuid), false);

-- B saw X a second ago and taps him too
select pg_temp.as_user('00000000-0000-0000-0000-0000000050a2');
select pg_temp.ok(not exists(select 1 from wasel_nearby_couriers(32.0775, 34.7745) where id = '00000000-0000-0000-0000-000000005001'),
  'X is hidden from other customers while he holds A''s request');
select set_config('t.s2', pg_temp.ship(auth.uid())::text, false);
select set_config('t.r2', wasel_request_courier(current_setting('t.s2')::uuid, '00000000-0000-0000-0000-000000005001')::text, false);
select pg_temp.ok((current_setting('t.r2')::jsonb->>'reason') = 'courier_reserved', 'B is told X was just taken by another customer');
select pg_temp.ok((current_setting('t.r2')::jsonb->>'action') = 'switched' and (current_setting('t.r2')::jsonb->>'to') = 'Wafa',
  'B is switched at once to the best free courier (W, nearest at the same price)');
reset role;
select pg_temp.ok((select requested_courier_id from wasel_shipments where id = current_setting('t.s2')::uuid) = '00000000-0000-0000-0000-000000005004'
  and exists(select 1 from wasel_shipment_offers where shipment_id = current_setting('t.s2')::uuid and courier_id = '00000000-0000-0000-0000-000000005004' and status = 'pending'),
  'W gets B''s request');
select pg_temp.ok((select price from wasel_shipments where id = current_setting('t.s2')::uuid) <= current_setting('t.moto')::numeric, 'B pays the same price');
select pg_temp.ok(not exists(select 1 from wasel_shipment_offers where shipment_id = current_setting('t.s2')::uuid and courier_id = '00000000-0000-0000-0000-000000005001'),
  'X never receives a second request');
select pg_temp.ok(exists(select 1 from wasel_notifications where user_id = '00000000-0000-0000-0000-0000000050a2' and title = 'courier_switched'), 'B is notified of the switch');
set role authenticated;

-- X declines A → A goes to the next best free courier (Y); Z's car would cost more, so it is not chosen automatically
select pg_temp.as_user('00000000-0000-0000-0000-000000005001');
select wasel_decline_offer(current_setting('t.s1')::uuid);
reset role;
select pg_temp.ok((select requested_courier_id from wasel_shipments where id = current_setting('t.s1')::uuid) = '00000000-0000-0000-0000-000000005002',
  'after a decline the next best courier at the same price is asked (Y, not the pricier car)');
set role authenticated;

-- held couriers are not pulled into "send to all"
select pg_temp.as_user('00000000-0000-0000-0000-0000000050a4');
select set_config('t.s3', pg_temp.ship(auth.uid(), 'broadcast')::text, false);
select wasel_broadcast_shipment(current_setting('t.s3')::uuid);
reset role;
select pg_temp.ok(not exists(select 1 from wasel_shipment_offers where shipment_id = current_setting('t.s3')::uuid
  and courier_id in ('00000000-0000-0000-0000-000000005002','00000000-0000-0000-0000-000000005004')), '"send to all" skips couriers holding a direct request');

-- Y had an older offer for D's delivery and accepts it → A moves on at once
insert into wasel_shipment_offers(shipment_id, courier_id, distance_km) values (current_setting('t.s3')::uuid, '00000000-0000-0000-0000-000000005002', 1);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000005002');
select wasel_accept_offer(current_setting('t.s3')::uuid);
reset role;
select pg_temp.ok((select last_fallback->>'reason' = 'taken_by_other' from wasel_shipments where id = current_setting('t.s1')::uuid),
  'when Y accepts another delivery, A''s request moves on immediately');
select pg_temp.ok((select dispatch_mode = 'broadcast' and price = current_setting('t.moto')::numeric from wasel_shipments where id = current_setting('t.s1')::uuid),
  'nobody else at that price is free, so A is sent to all nearby couriers at the original price');

-- W does not answer B in time → B goes to X (free again)
update wasel_shipment_offers set created_at = now() - interval '10 minutes' where shipment_id = current_setting('t.s2')::uuid and status = 'pending';
update wasel_shipments set last_dispatch_at = now() - interval '10 minutes' where id = current_setting('t.s2')::uuid;
select wasel_dispatch_tick();
select pg_temp.ok((select requested_courier_id from wasel_shipments where id = current_setting('t.s2')::uuid) = '00000000-0000-0000-0000-000000005001',
  'no answer in time: the system asks the next free courier by itself');
select pg_temp.ok((select status from wasel_shipment_offers where shipment_id = current_setting('t.s2')::uuid and courier_id = '00000000-0000-0000-0000-000000005004') = 'missed',
  'the courier who did not answer can still accept late (offer kept as missed)');

-- X goes offline while holding B's request → B is sent to all
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000005001');
update wasel_couriers set is_online = false where id = auth.uid();
reset role;
select pg_temp.ok((select last_fallback->>'reason' = 'courier_offline' and dispatch_mode = 'broadcast' from wasel_shipments where id = current_setting('t.s2')::uuid),
  'courier goes offline: the request moves on at once');

-- C prefers to choose herself
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000050a3');
select set_config('t.s4', pg_temp.ship(auth.uid(), 'ask_me')::text, false);
select set_config('t.r4', wasel_request_courier(current_setting('t.s4')::uuid, '00000000-0000-0000-0000-000000005002')::text, false);
select pg_temp.ok((current_setting('t.r4')::jsonb->>'reason') = 'courier_busy' and (current_setting('t.r4')::jsonb->>'action') = 'ask',
  '"let me choose": nothing is done automatically');
select pg_temp.ok((select from_json->>'from' = 'Yara' from (select last_fallback as from_json from wasel_shipments where id = current_setting('t.s4')::uuid) z),
  'the delivery page knows which courier was taken');
select pg_temp.ok((select same_price from wasel_suggest_couriers(current_setting('t.s4')::uuid) limit 1), 'suggestions show same-price couriers first');
select pg_temp.ok(exists(select 1 from wasel_suggest_couriers(current_setting('t.s4')::uuid) where vehicle = 'car' and not same_price),
  'pricier couriers are suggested too, marked as a different price');
select pg_temp.ok(not exists(select 1 from wasel_suggest_couriers(current_setting('t.s4')::uuid)
  where id in ('00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000005002')), 'offline and busy couriers are not suggested');
select pg_temp.ok((wasel_request_courier(current_setting('t.s4')::uuid, (select id from wasel_suggest_couriers(current_setting('t.s4')::uuid) limit 1))->>'ok')::boolean,
  'one tap on a suggestion asks that courier');
select pg_temp.as_user('00000000-0000-0000-0000-0000000050a1');
do $$ begin perform wasel_suggest_couriers(current_setting('t.s4')::uuid); raise exception 'FAIL: other sender';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: only the sender sees the suggestions'; end $$;
reset role;
\echo 'ALL SMART COURIER CHOICE TESTS PASSED'
