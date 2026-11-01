-- Wasel database test suite: roles, permissions and the B2C / C2C / B2B delivery journeys.
-- Run with scripts/test-db.sh (plain PostgreSQL + the Supabase stub). Every check raises on failure.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
grant all on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.uid', coalesce(p::text, ''), false); end $$;
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end $$;
set client_min_messages = notice;

-- ---------- fixtures: sign-ups through the auth trigger ----------
insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','shop@test','{"app":"wasel","role":"business","full_name":"Shop Owner","business_name":"Shop A"}'),
 ('00000000-0000-0000-0000-0000000000b1','store@test','{"app":"wasel","role":"business","full_name":"Store Owner","business_name":"Store B"}'),
 ('00000000-0000-0000-0000-0000000000c1','cust@test','{"app":"wasel","role":"customer","full_name":"Customer One"}'),
 ('00000000-0000-0000-0000-0000000000d1','c1@test','{"app":"wasel","role":"courier","full_name":"Courier One","vehicle":"motorcycle"}'),
 ('00000000-0000-0000-0000-0000000000d2','c2@test','{"app":"wasel","role":"courier","full_name":"Courier Two","vehicle":"car"}'),
 ('00000000-0000-0000-0000-0000000000e1','emp@test','{"app":"wasel","role":"customer","full_name":"Employee"}'),
 ('00000000-0000-0000-0000-0000000000f1','other@test','{"full_name":"Other app user"}');

select pg_temp.ok((select count(*) from wasel_profiles) = 6, 'only Wasel sign-ups get a Wasel profile');
select pg_temp.ok((select count(*) from wasel_user_roles where role = 'customer') = 6, 'every Wasel user can send as a customer');
select pg_temp.ok((select count(*) from wasel_business_members where member_role = 'owner') = 2, 'business sign-up creates business + owner membership');
select pg_temp.ok(not exists(select 1 from wasel_profiles where role = 'admin'), 'nobody can sign up as admin');

update wasel_couriers set verification = 'approved', is_online = true, last_seen_at = now(), lat = 31.905, lng = 35.205;
update wasel_couriers set lat = 31.907 where id = '00000000-0000-0000-0000-0000000000d2';
update wasel_businesses set lat = 31.95, lng = 35.22, address = 'Store B street' where owner_id = '00000000-0000-0000-0000-0000000000b1';

select set_config('test.shop_a', (select id::text from wasel_businesses where owner_id = '00000000-0000-0000-0000-0000000000a1'), false);
set role authenticated;

-- ---------- roles & business membership ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
update wasel_profiles set role = 'admin' where id = auth.uid();
select pg_temp.ok((select role from wasel_profiles where id = auth.uid()) = 'customer', 'user cannot switch home role to a role they do not hold');
select wasel_add_role('courier');
select pg_temp.ok(wasel_has_role('courier'), 'customer can become a courier');
select pg_temp.ok((select verification from wasel_couriers where id = auth.uid()) = 'pending', 'new courier role starts pending verification');
do $$ begin perform wasel_add_role('admin'); raise exception 'FAIL: admin self-assign'; exception when others then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: cannot self-assign admin'; end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select wasel_add_member((select id from wasel_businesses where owner_id = auth.uid()), 'emp@test', 'dispatcher');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok(wasel_has_role('business'), 'invited employee gets the business role');
select pg_temp.ok((select count(*) from wasel_businesses) = 1, 'employee sees only their own business');
do $$ begin
  perform wasel_add_member((select business_id from wasel_business_members where user_id = auth.uid()), 'cust@test', 'dispatcher');
  raise exception 'FAIL: dispatcher invited';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: dispatcher cannot invite members'; end $$;
select pg_temp.ok((select count(*) from wasel_business_team((select business_id from wasel_business_members where user_id = auth.uid()))) = 2, 'team list shows owner + employee');

-- ---------- Scenario A: B2C created by an employee ----------
insert into wasel_shipments(business_id, sender_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, price)
select business_id, auth.uid(), 'Shop A', 31.9038, 35.2034, 'Customer home', 31.91, 35.22, 'Rami', '0590000000', 0.01
from wasel_business_members where user_id = auth.uid();
select pg_temp.ok((select delivery_type from wasel_shipments order by created_at desc limit 1) = 'b2c', 'A: business → person is B2C');
select pg_temp.ok((select price from wasel_shipments order by created_at desc limit 1) > 1, 'A: client price is ignored, server prices it');
select pg_temp.ok(wasel_dispatch_shipment((select id from wasel_shipments order by created_at desc limit 1)) = 2, 'A: dispatch notifies nearby couriers');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select count(*) from wasel_shipments) = 1, 'A: business owner sees the employee''s delivery');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.ok((select status from wasel_accept_offer((select id from wasel_shipments limit 1))) = 'accepted', 'A: courier accepts');
select wasel_advance_shipment((select id from wasel_shipments limit 1), 'picked_up');
select wasel_advance_shipment((select id from wasel_shipments limit 1), 'delivered', null, null,
  (select delivery_otp from wasel_shipments limit 1));
select pg_temp.ok((select count(*) from wasel_ledger where kind = 'platform_fee') = 1, 'A: platform fee recorded on delivery');

-- ---------- Scenario B: C2C with OTP ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  insert into wasel_shipments(business_id, sender_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone)
  values (current_setting('test.shop_a')::uuid, auth.uid(), 'x', 31.9, 35.2, 'y', 31.91, 35.21, 'r', '1');
  raise exception 'FAIL: customer posted as business';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: customer cannot post on behalf of a business'; end $$;
insert into wasel_shipments(sender_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone)
values (auth.uid(), 'My home', 31.9040, 35.2040, 'Friend', 31.92, 35.21, 'Friend', '0591111111');
select pg_temp.ok((select delivery_type from wasel_shipments where sender_id = auth.uid() and business_id is null) = 'c2c', 'B: person → person is C2C');
reset role;   -- make the sender's own courier account approved, online and right next to the pickup
update wasel_couriers set verification = 'approved', is_online = true, last_seen_at = now(), lat = 31.9040, lng = 35.2040
 where id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select pg_temp.ok(wasel_dispatch_shipment((select id from wasel_shipments where delivery_type = 'c2c')) = 2, 'B: both free couriers are notified');
reset role;
select pg_temp.ok(not exists(select 1 from wasel_shipment_offers where courier_id = '00000000-0000-0000-0000-0000000000c1'),
  'B: the sender never receives their own request as a courier');
update wasel_couriers set is_online = false where id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select wasel_accept_offer((select id from wasel_shipments where delivery_type = 'c2c'));
select wasel_advance_shipment((select id from wasel_shipments where delivery_type = 'c2c'), 'picked_up');
do $$ begin
  perform wasel_advance_shipment((select id from wasel_shipments where delivery_type = 'c2c'), 'delivered', null, null, '0000x');
  raise exception 'FAIL: wrong otp accepted';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: B: wrong delivery code rejected'; end $$;
select wasel_advance_shipment((select id from wasel_shipments where delivery_type = 'c2c'), 'delivered', null, null,
  (select delivery_otp from wasel_shipments where delivery_type = 'c2c'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select count(*) from wasel_ledger) >= 2, 'B: customer can read the ledger rows of their own delivery');
select pg_temp.ok((wasel_get_tracking((select tracking_token from wasel_shipments where delivery_type = 'c2c'))->>'business_name') = 'Customer One',
  'B: tracking link shows the individual sender name');

-- ---------- Scenario C: B2B, receiving business can follow it ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select count(*) from wasel_search_businesses('Store')) = 1, 'C: receiving business is searchable');
insert into wasel_shipments(business_id, sender_id, recipient_business_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone)
select (select id from wasel_businesses where owner_id = auth.uid()), auth.uid(), b.id, 'Shop A', 31.9038, 35.2034, b.address, b.lat, b.lng, b.business_name, '0592222222'
from wasel_search_businesses('Store') b;
select pg_temp.ok((select delivery_type from wasel_shipments where recipient_business_id is not null) = 'b2b', 'C: business → business is B2B');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((select count(*) from wasel_shipments) = 1, 'C: receiving business sees only the incoming delivery');

-- ---------- Scenario D: competing couriers, only one assignment ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select wasel_dispatch_shipment((select id from wasel_shipments where delivery_type = 'b2b'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select wasel_accept_offer((select id from wasel_shipments where delivery_type = 'b2b'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
do $$ begin
  perform wasel_accept_offer((select id from wasel_shipments where delivery_type = 'b2b'));
  raise exception 'FAIL: double assignment';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: D: second courier is refused'; end $$;
reset role;
select pg_temp.ok((select count(*) from wasel_shipment_offers o join wasel_shipments s on s.id = o.shipment_id
  where s.delivery_type = 'b2b' and o.status = 'accepted') = 1, 'D: exactly one accepted offer');
set role authenticated;

-- ---------- Scenario E: cancellation rules ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select wasel_advance_shipment((select id from wasel_shipments where delivery_type = 'b2b'), 'picked_up');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform wasel_cancel_shipment((select id from wasel_shipments where delivery_type = 'b2b'), 'late');
  raise exception 'FAIL: cancelled after pickup';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: E: no cancel after pickup'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into wasel_shipments(sender_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone)
values (auth.uid(), 'a', 31.9, 35.2, 'b', 31.91, 35.21, 'r', '1');
select pg_temp.ok((select cancelled_by from wasel_cancel_shipment((select id from wasel_shipments where status = 'searching'), 'changed mind')) = 'customer',
  'E: customer cancels while searching');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform wasel_cancel_shipment((select id from wasel_shipments where delivery_type = 'b2b'), 'x');
  raise exception 'FAIL: receiver cancelled';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: E: receiving business cannot cancel the sender''s delivery'; end $$;

reset role;
select pg_temp.ok((select count(*) from wasel_profiles where id = '00000000-0000-0000-0000-0000000000f1') = 0, 'other app users untouched');
\echo 'ALL WASEL DATABASE TESTS PASSED'
