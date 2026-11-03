-- Uber-style courier choice (migration 006): nearest couriers list, direct request, decline, send to all, phone sign-up.
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
update wasel_couriers set is_online = false;   -- isolate from the other suites
insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000030a1','sara@test','{"app":"wasel","role":"customer","full_name":"Sara Customer"}'),
 ('00000000-0000-0000-0000-0000000030c1','near@test','{"app":"wasel","role":"courier","full_name":"Near Biker","vehicle":"motorcycle"}'),
 ('00000000-0000-0000-0000-0000000030c2','car@test','{"app":"wasel","role":"courier","full_name":"Car Driver","vehicle":"car"}'),
 ('00000000-0000-0000-0000-0000000030c3','busy@test','{"app":"wasel","role":"courier","full_name":"Busy Rider","vehicle":"motorcycle"}');
insert into auth.users(id, phone, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000030f1','972521234567','{"app":"wasel","role":"customer","full_name":"Phone User"}');
select pg_temp.ok((select phone from wasel_profiles where id = '00000000-0000-0000-0000-0000000030f1') = '972521234567',
  'phone (SMS) sign-up creates a customer profile with the verified phone');
update wasel_couriers set verification = 'approved', is_online = true, last_seen_at = now(), lat = v.lat, lng = v.lng
from (values ('00000000-0000-0000-0000-0000000030c1'::uuid, 32.0790, 34.7810),
             ('00000000-0000-0000-0000-0000000030c2'::uuid, 32.0700, 34.7900),
             ('00000000-0000-0000-0000-0000000030c3'::uuid, 32.0780, 34.7750)) v(id, lat, lng)
where wasel_couriers.id = v.id;
-- busy courier already has a job
insert into wasel_shipments(sender_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone)
values ('00000000-0000-0000-0000-0000000030a1', 'x', 32.07, 34.78, 'y', 32.06, 34.77, 'r', '1');
update wasel_shipments set status = 'accepted', courier_id = '00000000-0000-0000-0000-0000000030c3'
 where sender_id = '00000000-0000-0000-0000-0000000030a1';

-- guests can see the list (first names only)
set role anon;
select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from wasel_nearby_couriers(32.0775, 34.7745)) = 2, 'guest sees the available couriers near the pickup (busy one excluded)');
select pg_temp.ok((select full_name from wasel_nearby_couriers(32.0775, 34.7745) limit 1) = 'Near', 'nearest first, guests see the first name only');
select pg_temp.ok((select count(*) from wasel_nearby_couriers(32.0775, 34.7745, 'car')) = 1, 'list respects the vehicle the package needs');

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000030a1');
select pg_temp.ok((select full_name from wasel_nearby_couriers(32.0775, 34.7745) limit 1) = 'Near Biker', 'signed-in customer sees full names');
insert into wasel_shipments(sender_id, dispatch_mode, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, vehicle)
values (auth.uid(), 'direct', 'Dizengoff 50', 32.0775, 34.7745, 'Rothschild 22', 32.0636, 34.7747, 'Noa', '052', 'motorcycle');
select set_config('test.ship', (select id::text from wasel_shipments where sender_id = auth.uid() and status = 'searching'), false);
select pg_temp.ok(wasel_dispatch_shipment(current_setting('test.ship')::uuid) = 0, 'a direct delivery is not broadcast');
select set_config('test.price_moto', (select price::text from wasel_shipments where id = current_setting('test.ship')::uuid), false);

-- choose the car driver: price follows the car
select wasel_request_courier(current_setting('test.ship')::uuid, '00000000-0000-0000-0000-0000000030c2');
select pg_temp.ok((select price from wasel_shipments where id = current_setting('test.ship')::uuid) > current_setting('test.price_moto')::numeric,
  'choosing a car courier re-prices the delivery for a car');
select pg_temp.ok((wasel_direct_request(current_setting('test.ship')::uuid)->>'offer_status') = 'pending', 'sender sees the request is pending');
do $$ begin perform wasel_request_courier(current_setting('test.ship')::uuid, '00000000-0000-0000-0000-0000000030c3'); raise exception 'FAIL: busy';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: a busy courier cannot be requested'; end $$;

-- the other free courier does not get it through the heartbeat
select pg_temp.as_user('00000000-0000-0000-0000-0000000030c1');
select wasel_courier_heartbeat();
select pg_temp.ok(not exists(select 1 from wasel_shipment_offers where courier_id = auth.uid()), 'other couriers do not receive a direct request');

-- chosen courier declines -> sender is told
select pg_temp.as_user('00000000-0000-0000-0000-0000000030c2');
select wasel_decline_offer(current_setting('test.ship')::uuid);
select pg_temp.as_user('00000000-0000-0000-0000-0000000030a1');
select pg_temp.ok(exists(select 1 from wasel_notifications where user_id = auth.uid() and title = 'courier_declined'), 'sender is notified when the chosen courier declines');
select pg_temp.ok((wasel_direct_request(current_setting('test.ship')::uuid)->>'offer_status') = 'declined', 'and sees the decline on the delivery');

-- choose another one, then switch to everyone
select wasel_request_courier(current_setting('test.ship')::uuid, '00000000-0000-0000-0000-0000000030c1');
select pg_temp.ok((wasel_direct_request(current_setting('test.ship')::uuid)->>'name') = 'Near Biker', 'sender can pick another courier');
select pg_temp.ok(wasel_broadcast_shipment(current_setting('test.ship')::uuid) >= 1, '"send to all" notifies the nearby couriers');
select pg_temp.ok((select price from wasel_shipments where id = current_setting('test.ship')::uuid) = current_setting('test.price_moto')::numeric,
  '"send to all" goes back to the price for the vehicle the package needs');
select pg_temp.as_user('00000000-0000-0000-0000-0000000030c1');
select pg_temp.ok((select status from wasel_accept_offer(current_setting('test.ship')::uuid)) = 'accepted', 'a courier accepts');
reset role;
\echo 'ALL CHOOSE-COURIER TESTS PASSED'
