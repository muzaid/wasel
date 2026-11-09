-- Refunds, Wasel credit, coupons / discount codes, help desk (migration 007).
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.uid', coalesce(p::text, ''), false); end $$;
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end $$;
create or replace function pg_temp.fails(q text, label text) returns void language plpgsql as $$
begin execute q; raise exception 'FAIL: %', label;
exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS: % (%)', label, sqlerrm; end $$;
grant all on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
set client_min_messages = notice;
reset role;
update wasel_couriers set is_online = false;
insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000040a0','admin40@test','{"app":"wasel","role":"customer","full_name":"Admin Forty"}'),
 ('00000000-0000-0000-0000-0000000040a1','dana40@test','{"app":"wasel","role":"customer","full_name":"Dana Customer"}'),
 ('00000000-0000-0000-0000-0000000040a2','eve40@test','{"app":"wasel","role":"customer","full_name":"Eve Other"}'),
 ('00000000-0000-0000-0000-0000000040b1','shop40@test','{"app":"wasel","role":"business","full_name":"Shop Owner","business_name":"Forty Shop"}'),
 ('00000000-0000-0000-0000-0000000040c1','moto40@test','{"app":"wasel","role":"courier","full_name":"Moto Forty","vehicle":"motorcycle"}'),
 ('00000000-0000-0000-0000-0000000040c2','car40@test','{"app":"wasel","role":"courier","full_name":"Car Forty","vehicle":"car"}');
insert into wasel_user_roles(user_id, role) values ('00000000-0000-0000-0000-0000000040a0', 'admin') on conflict do nothing;
update wasel_couriers set verification = 'approved', is_online = true, last_seen_at = now(), lat = 32.0790, lng = 34.7810
 where id in ('00000000-0000-0000-0000-0000000040c1','00000000-0000-0000-0000-0000000040c2');
select set_config('t.biz', (select id::text from wasel_businesses where owner_id = '00000000-0000-0000-0000-0000000040b1'), false);

-- ---------- coupons ----------
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a0');
insert into wasel_coupons(code, title, kind, value) values (' welcome10 ', '10% off', 'percent', 10);
select pg_temp.ok((select code from wasel_coupons where code = 'WELCOME10') is not null, 'admin creates a Wasel coupon (code cleaned to upper case)');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a1');
select pg_temp.fails($$insert into wasel_coupons(code, kind, value) values ('FREE100','percent',100)$$, 'a customer cannot create coupons');
select pg_temp.ok((select count(*) from wasel_coupons) = 0, 'customers cannot read the coupon table');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040b1');
insert into wasel_coupons(code, title, business_id, kind, value) values ('SHOP5', '₪5 off', current_setting('t.biz')::uuid, 'fixed', 5);
select pg_temp.ok(exists(select 1 from wasel_coupons where code = 'SHOP5'), 'a business owner creates a discount code for the business');
select pg_temp.fails($$insert into wasel_coupons(code, kind, value) values ('MINE','fixed',5)$$, 'a business cannot create Wasel-wide coupons');
update wasel_coupons set used_count = 99 where code = 'SHOP5';
select pg_temp.ok((select used_count from wasel_coupons where code = 'SHOP5') = 0, 'usage counter cannot be changed by the client');

-- delivery for Dana; she tries to set her own discount on insert
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a1');
insert into wasel_shipments(sender_id, dispatch_mode, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, vehicle, discount_amount, credit_used)
values (auth.uid(), 'direct', 'Dizengoff 50', 32.0775, 34.7745, 'Rothschild 22', 32.0636, 34.7747, 'Noa', '052', 'motorcycle', 50, 50);
select set_config('t.s1', (select id::text from wasel_shipments where sender_id = auth.uid() order by created_at desc limit 1), false);
select pg_temp.ok((select discount_amount = 0 and credit_used = 0 from wasel_shipments where id = current_setting('t.s1')::uuid), 'money fields sent by the client are ignored');
select pg_temp.ok((wasel_check_coupon('SHOP5', 20)->>'error') = 'coupon_other_business', 'a business code only works on deliveries to that business');
select pg_temp.ok((wasel_check_coupon('nope', 20)->>'error') = 'coupon_not_found', 'unknown code is reported');
select pg_temp.ok((wasel_check_coupon('welcome10', 20)->>'discount')::numeric = 2, 'checkout preview: 10% of ₪20 = ₪2');
select pg_temp.ok((select count(*) from wasel_my_coupons()) >= 2, 'customer sees public coupons in "Your coupons"');
select wasel_apply_coupon(current_setting('t.s1')::uuid, 'welcome10');
select pg_temp.ok((select discount_amount = round(price * 0.10, 2) from wasel_shipments where id = current_setting('t.s1')::uuid), 'coupon applied: discount = 10% of the price');
select pg_temp.fails($$select wasel_apply_coupon(current_setting('t.s1')::uuid, 'welcome10')$$, 'only one coupon per delivery');
-- choose the car courier: price goes up, discount follows
select wasel_request_courier(current_setting('t.s1')::uuid, '00000000-0000-0000-0000-0000000040c2');
select pg_temp.ok((select discount_amount = round(price * 0.10, 2) from wasel_shipments where id = current_setting('t.s1')::uuid), 're-pricing keeps the discount at 10% of the new price');
select wasel_cancel_shipment(current_setting('t.s1')::uuid, 'changed my mind');
reset role;
select pg_temp.ok((select used_count from wasel_coupons where code = 'WELCOME10') = 0, 'cancelled delivery gives the coupon use back');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a1');
select pg_temp.ok((wasel_check_coupon('WELCOME10', 20)->>'ok')::boolean, 'and the customer can use it again');

-- ---------- refunds ----------
insert into wasel_shipments(sender_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, dispatch_mode)
values (auth.uid(), 'A', 32.0775, 34.7745, 'B', 32.0636, 34.7747, 'Noa', '052', 'direct');
select set_config('t.s2', (select id::text from wasel_shipments where sender_id = auth.uid() and status = 'searching' order by created_at desc limit 1), false);
select pg_temp.fails($$select wasel_request_refund(current_setting('t.s2')::uuid, 'late', null, 1)$$, 'no refund while still searching');
reset role;
update wasel_shipments set status = 'delivered', courier_id = '00000000-0000-0000-0000-0000000040c1', delivered_at = now() where id = current_setting('t.s2')::uuid;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a1');
select pg_temp.fails($$select wasel_request_refund(current_setting('t.s2')::uuid, 'damaged', 'broken', 9999)$$, 'refund cannot be more than was paid');
select set_config('t.r1', wasel_request_refund(current_setting('t.s2')::uuid, 'damaged', 'Box crushed', 5, null, 'credit')::text, false);
select pg_temp.fails($$select wasel_request_refund(current_setting('t.s2')::uuid, 'late', null, 1)$$, 'only one open refund request per delivery');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a0');
select pg_temp.ok(exists(select 1 from wasel_notifications where user_id = auth.uid() and title = 'refund_requested'), 'admins are notified of a new refund request');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a2');
select pg_temp.ok((select count(*) from wasel_refunds) = 0, 'other customers cannot see the refund');
select pg_temp.fails($$select wasel_decide_refund(current_setting('t.r1')::bigint, true)$$, 'only an admin can approve a refund');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a0');
select wasel_decide_refund(current_setting('t.r1')::bigint, true, 'Sorry!');
select pg_temp.ok(exists(select 1 from wasel_ledger where shipment_id = current_setting('t.s2')::uuid and kind = 'refund' and amount = 5), 'approved refund is written to the ledger');
select pg_temp.fails($$select wasel_decide_refund(current_setting('t.r1')::bigint, false)$$, 'a decided refund cannot be decided again');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a1');
select pg_temp.ok((select balance from wasel_wallets where user_id = auth.uid()) = 5, 'refund as Wasel credit fills the wallet');
select pg_temp.ok(exists(select 1 from wasel_notifications where user_id = auth.uid() and title = 'refund_approved'), 'customer is told the refund was approved');
update wasel_wallets set balance = 1000 where user_id = auth.uid();
select pg_temp.ok((select balance from wasel_wallets where user_id = auth.uid()) = 5, 'customer cannot change their own credit');

-- ---------- spend credit, give it back on cancel ----------
insert into wasel_shipments(sender_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, dispatch_mode)
values (auth.uid(), 'C', 32.0775, 34.7745, 'D', 32.0636, 34.7747, 'Noa', '052', 'direct');
select set_config('t.s3', (select id::text from wasel_shipments where sender_id = auth.uid() and status = 'searching' order by created_at desc limit 1), false);
select pg_temp.ok(wasel_apply_credit(current_setting('t.s3')::uuid) = 5, 'credit pays ₪5 of the next delivery');
select pg_temp.ok((select balance from wasel_wallets where user_id = auth.uid()) = 0, 'wallet goes down');
select wasel_cancel_shipment(current_setting('t.s3')::uuid, 'oops');
select pg_temp.ok((select balance from wasel_wallets where user_id = auth.uid()) = 5, 'cancelling gives the credit back');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a2');
select pg_temp.fails($$select wasel_apply_credit(current_setting('t.s3')::uuid)$$, 'nobody else can spend credit on your delivery');

-- ---------- help desk / contact us ----------
set role anon;
select pg_temp.as_user(null);
select pg_temp.fails($$select wasel_open_ticket('other','Hello','Hi there')$$, 'guest must leave an email or phone');
select set_config('t.g1', wasel_open_ticket('partnership', 'Partnership', 'We are a shop chain', 'Yael', 'yael@shop.test')::text, false);
select pg_temp.ok(current_setting('t.g1')::bigint > 0, 'guest can send the contact-us form');
select pg_temp.ok((select count(*) from wasel_tickets) = 0, 'guests cannot read tickets');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a1');
select set_config('t.k1', wasel_open_ticket('delivery', 'Wrong address', 'Please fix the drop-off', null, null, null, current_setting('t.s2')::uuid, 'customer')::text, false);
select pg_temp.ok((select count(*) from wasel_tickets) = 1, 'customer sees only their own tickets');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a2');
select pg_temp.fails($$select wasel_ticket_reply(current_setting('t.k1')::bigint, 'hi')$$, 'others cannot write in your ticket');
select pg_temp.fails($$select wasel_open_ticket('delivery','x','y',null,null,null,current_setting('t.s2')::uuid)$$, 'cannot attach someone else''s delivery');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a0');
select pg_temp.ok((select count(*) from wasel_tickets where id in (current_setting('t.k1')::bigint, current_setting('t.g1')::bigint)) = 2, 'admin sees all tickets');
select wasel_ticket_reply(current_setting('t.k1')::bigint, 'Fixed, the courier knows');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a1');
select pg_temp.ok((select status from wasel_tickets where id = current_setting('t.k1')::bigint) = 'answered', 'admin reply marks the ticket answered');
select pg_temp.ok(exists(select 1 from wasel_notifications where user_id = auth.uid() and title = 'ticket_answered'), 'customer is notified of the answer');
select pg_temp.ok((select count(*) from wasel_ticket_messages where ticket_id = current_setting('t.k1')::bigint) = 2, 'customer reads the whole thread');
select wasel_ticket_status(current_setting('t.k1')::bigint, 'solved');
select pg_temp.ok((select status from wasel_tickets where id = current_setting('t.k1')::bigint) = 'solved', 'customer can mark it solved');
reset role;
\echo 'ALL SUPPORT / REFUND / COUPON TESTS PASSED'
