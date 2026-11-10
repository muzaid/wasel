-- =====================================================================
-- Wasel migration 008 — smart courier choice when two customers want the same courier
--
--   1. Hold: a courier who was asked directly is reserved for that customer while the request is open
--      (offer timeout). He disappears from other customers' lists and from "send to all" rounds.
--   2. No double booking: requests for the same courier are serialized with a row lock, so when two
--      customers tap the same courier in the same second only the first one gets him.
--   3. Fallback chosen by the customer (fallback_mode):
--        next_best (default) – the system asks the best free courier at the same price or cheaper (max 3 tries),
--                              then sends to all nearby couriers
--        broadcast           – send to all nearby couriers right away
--        ask_me              – show the customer the best alternatives and let them choose
--   4. Triggers for the fallback: courier already reserved / busy / offline, declined, no answer in time,
--      or he accepted another delivery.
--   5. Suggestions ranked by distance and rating, with the price for each courier's vehicle.
-- Run once in Supabase → SQL Editor after 007. Safe to re-run.
-- =====================================================================

alter table wasel_shipments add column if not exists fallback_mode text not null default 'next_best';
alter table wasel_shipments drop constraint if exists wasel_shipments_fallback_mode_check;
alter table wasel_shipments add constraint wasel_shipments_fallback_mode_check check (fallback_mode in ('next_best','broadcast','ask_me'));
alter table wasel_shipments add column if not exists direct_attempts int not null default 0;
alter table wasel_shipments add column if not exists max_auto_price numeric(10,2);      -- price the customer agreed to
alter table wasel_shipments add column if not exists last_fallback jsonb;                -- what the system did last, for the sender's screen

-- the client chooses the fallback, never the counters
create or replace function wasel_shipment_choice_reset() returns trigger language plpgsql as $$
begin new.direct_attempts := 0; new.max_auto_price := null; new.last_fallback := null; return new; end $$;
drop trigger if exists wasel_shipment_choice_reset on wasel_shipments;
create trigger wasel_shipment_choice_reset before insert on wasel_shipments for each row execute function wasel_shipment_choice_reset();

-- ---------- is this courier held by another customer's open request? (returns that delivery) ----------
create or replace function wasel__reserved_by(p_courier uuid, p_except uuid default null) returns uuid
language sql stable security definer set search_path = public as $$
  select x.id from wasel_shipments x
  join wasel_shipment_offers o on o.shipment_id = x.id and o.courier_id = p_courier and o.status = 'pending'
  where x.status = 'searching' and x.dispatch_mode = 'direct' and x.requested_courier_id = p_courier
    and x.id is distinct from p_except
    and o.created_at > now() - make_interval(secs => (select offer_timeout_sec from wasel_settings where id = 1))
  limit 1;
$$;

-- ---------- why a courier can't be asked for a delivery ('' = he can) ----------
create or replace function wasel__courier_problem(p_courier uuid, p_shipment uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare c wasel_couriers; blocked boolean; sh wasel_shipments;
begin
  select * into c from wasel_couriers where id = p_courier;
  select * into sh from wasel_shipments where id = p_shipment;
  select is_blocked into blocked from wasel_profiles where id = p_courier;
  if c is null or not c.is_online or c.verification <> 'approved' or coalesce(blocked, true) or c.lat is null
     or c.last_seen_at is null or c.last_seen_at < now() - interval '3 minutes' or c.id = sh.sender_id
     or wasel_vehicle_rank(c.vehicle) < wasel_vehicle_rank(coalesce(sh.required_vehicle, sh.vehicle)) then
    return 'courier_unavailable';
  end if;
  if exists(select 1 from wasel_shipments x where x.courier_id = p_courier and x.status in ('accepted','arrived_pickup','picked_up','in_transit')) then
    return 'courier_busy';
  end if;
  if wasel__reserved_by(p_courier, p_shipment) is not null then return 'courier_reserved'; end if;
  return '';
end $$;

-- ---------- free couriers for a delivery, best first ----------
-- score = distance in km + 1.5 km for every star below 4.8 (new couriers with < 3 ratings count as 4.6)
create or replace function wasel__candidates(p_shipment uuid) returns table(id uuid, distance_km numeric, price numeric, score numeric)
language sql stable security definer set search_path = public as $$
  with sh as (select * from wasel_shipments where id = p_shipment), s as (select * from wasel_settings where id = 1)
  select c.id, round(wasel_haversine_km(sh.pickup_lat, sh.pickup_lng, c.lat, c.lng)::numeric, 2),
         (select q.price from wasel_quote_price(sh.distance_km, sh.package_size, c.vehicle, sh.is_fragile, sh.cod_amount) q),
         round((wasel_haversine_km(sh.pickup_lat, sh.pickup_lng, c.lat, c.lng)
           + greatest(0, 4.8 - case when c.rating_count < 3 then 4.6 else c.rating_avg end) * 15)::numeric, 3)
  from sh, s, wasel_couriers c
  where c.lat is not null
    and wasel_haversine_km(sh.pickup_lat, sh.pickup_lng, c.lat, c.lng) <= s.max_radius_km
    and not exists(select 1 from wasel_shipment_offers o where o.shipment_id = sh.id and o.courier_id = c.id)  -- not tried yet
    and wasel__courier_problem(c.id, sh.id) = '';
$$;
revoke execute on function wasel__reserved_by(uuid, uuid) from public, anon, authenticated;
revoke execute on function wasel__courier_problem(uuid, uuid) from public, anon, authenticated;
revoke execute on function wasel__candidates(uuid) from public, anon, authenticated;

-- ---------- ask one courier (internal; callers check permissions and availability) ----------
create or replace function wasel__direct_ask(p_id uuid, p_courier uuid) returns void
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; co wasel_couriers; q record; d numeric;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  select * into co from wasel_couriers where id = p_courier;
  select * into q from wasel_quote_price(sh.distance_km, sh.package_size, co.vehicle, sh.is_fragile, sh.cod_amount);
  d := round(wasel_haversine_km(sh.pickup_lat, sh.pickup_lng, co.lat, co.lng)::numeric, 2);
  update wasel_shipment_offers set status = 'expired' where shipment_id = p_id and status = 'pending' and courier_id <> p_courier;
  insert into wasel_shipment_offers(shipment_id, courier_id, distance_km) values (p_id, p_courier, d)
  on conflict (shipment_id, courier_id) do update set status = 'pending', created_at = now(), distance_km = excluded.distance_km;
  update wasel_shipments set dispatch_mode = 'direct', requested_courier_id = p_courier, vehicle = co.vehicle,
    price = q.price, platform_fee = q.platform_fee, courier_earning = q.courier_earning,
    last_dispatch_at = now(), dispatch_round = dispatch_round + 1
  where id = p_id;
  insert into wasel_shipment_events(shipment_id, status, note) values (p_id, 'searching', 'requested_courier');
  perform wasel_notify(p_courier, 'new_offer', sh.pickup_address || ' → ' || sh.dropoff_address, '/courier');
end $$;

-- ---------- send to all (internal) ----------
create or replace function wasel__broadcast(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; q record; v wasel_vehicle_type;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or sh.status <> 'searching' then return 0; end if;
  v := coalesce(sh.required_vehicle, sh.vehicle);            -- back to the vehicle the package needs (same price or cheaper)
  select * into q from wasel_quote_price(sh.distance_km, sh.package_size, v, sh.is_fragile, sh.cod_amount);
  delete from wasel_shipment_offers where shipment_id = p_id and status in ('pending','expired','missed');
  update wasel_shipments set dispatch_mode = 'broadcast', requested_courier_id = null, vehicle = v,
    price = q.price, platform_fee = q.platform_fee, courier_earning = q.courier_earning where id = p_id;
  return wasel__dispatch(p_id);
end $$;

create or replace function wasel_broadcast_shipment(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  update wasel_shipments set last_fallback = null where id = p_id;
  return wasel__broadcast(p_id);
end $$;
grant execute on function wasel_broadcast_shipment(uuid) to authenticated;

-- ---------- the chosen courier can't take it: follow the customer's preference ----------
create or replace function wasel__direct_fallback(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; old_name text; nxt uuid; nxt_name text; info jsonb; cap numeric;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or sh.status <> 'searching' then return null; end if;
  select split_part(full_name, ' ', 1) into old_name from wasel_profiles where id = sh.requested_courier_id;
  -- close the request to the courier who can't take it (a courier who simply did not answer may still accept late)
  update wasel_shipment_offers set status = case p_reason when 'no_answer' then 'missed'::wasel_offer_status
      when 'declined' then 'declined'::wasel_offer_status else 'expired'::wasel_offer_status end
  where shipment_id = p_id and courier_id = sh.requested_courier_id and status = 'pending';
  update wasel_shipments set direct_attempts = direct_attempts + 1 where id = p_id returning * into sh;
  cap := coalesce(sh.max_auto_price, sh.price);

  if sh.fallback_mode = 'next_best' and sh.direct_attempts <= 3 then
    select c.id into nxt from wasel__candidates(p_id) c where c.price <= cap order by c.score, c.distance_km limit 1;
    if nxt is not null then
      perform wasel__direct_ask(p_id, nxt);
      select split_part(full_name, ' ', 1) into nxt_name from wasel_profiles where id = nxt;
      info := jsonb_build_object('reason', p_reason, 'from', old_name, 'action', 'switched', 'to', nxt_name, 'at', now());
      update wasel_shipments set last_fallback = info where id = p_id;
      insert into wasel_shipment_events(shipment_id, status, note) values (p_id, 'searching', 'auto_switched: ' || p_reason);
      perform wasel_notify(sh.sender_id, 'courier_switched', coalesce(old_name, '?') || ' → ' || nxt_name, wasel_sender_link(sh));
      return info;
    end if;
  end if;

  if sh.fallback_mode in ('next_best', 'broadcast') then
    perform wasel__broadcast(p_id);
    info := jsonb_build_object('reason', p_reason, 'from', old_name, 'action', 'broadcast', 'at', now());
    update wasel_shipments set last_fallback = info where id = p_id;
    insert into wasel_shipment_events(shipment_id, status, note) values (p_id, 'searching', 'auto_broadcast: ' || p_reason);
    perform wasel_notify(sh.sender_id, 'courier_unavailable_all', coalesce(old_name, '?'), wasel_sender_link(sh));
  else
    info := jsonb_build_object('reason', p_reason, 'from', old_name, 'action', 'ask', 'at', now());
    update wasel_shipments set last_fallback = info where id = p_id;
    perform wasel_notify(sh.sender_id, 'courier_unavailable', coalesce(old_name, '?'), wasel_sender_link(sh));
  end if;
  return info;
end $$;
revoke execute on function wasel__direct_ask(uuid, uuid) from public, anon, authenticated;
revoke execute on function wasel__broadcast(uuid) from public, anon, authenticated;
revoke execute on function wasel__direct_fallback(uuid, text) from public, anon, authenticated;

-- ---------- suggestions for the sender: best free couriers, with the price for each ----------
create or replace function wasel_suggest_couriers(p_id uuid, p_limit int default 3)
returns table(id uuid, full_name text, avatar_url text, vehicle wasel_vehicle_type, vehicle_model text, rating numeric,
              rating_count int, deliveries int, distance_km numeric, price numeric, same_price boolean)
language plpgsql stable security definer set search_path = public as $$
declare sh wasel_shipments;
begin
  select * into sh from wasel_shipments where wasel_shipments.id = p_id;
  if sh is null or not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  return query
    select c.id, p.full_name, p.avatar_url, co.vehicle, co.vehicle_model, co.rating_avg, co.rating_count, co.total_deliveries,
           c.distance_km, c.price, c.price <= coalesce(sh.max_auto_price, sh.price)
    from wasel__candidates(p_id) c join wasel_couriers co on co.id = c.id join wasel_profiles p on p.id = c.id
    order by (c.price <= coalesce(sh.max_auto_price, sh.price)) desc, c.score, c.distance_km
    limit least(greatest(coalesce(p_limit, 3), 1), 10);
end $$;
grant execute on function wasel_suggest_couriers(uuid, int) to authenticated;

-- ---------- sender asks one courier: first come, first served ----------
drop function if exists wasel_request_courier(uuid, uuid);
create function wasel_request_courier(p_id uuid, p_courier uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; prob text; info jsonb; nm text; agreed numeric; co wasel_couriers;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  if sh.status <> 'searching' then raise exception 'not_searching'; end if;
  -- lock the courier: two customers asking for him at the same moment are handled one after the other
  select * into co from wasel_couriers where id = p_courier for update;
  prob := wasel__courier_problem(p_courier, p_id);
  select split_part(full_name, ' ', 1) into nm from wasel_profiles where id = p_courier;

  if prob = '' then
    perform wasel__direct_ask(p_id, p_courier);
    update wasel_shipments set max_auto_price = price, direct_attempts = 0, last_fallback = null where id = p_id;
    return jsonb_build_object('ok', true, 'courier', nm);
  end if;

  -- a request to another courier is still open: keep it, just say this one can't be asked
  if sh.requested_courier_id is not null and sh.requested_courier_id <> p_courier and exists(
       select 1 from wasel_shipment_offers where shipment_id = p_id and courier_id = sh.requested_courier_id and status = 'pending') then
    return jsonb_build_object('ok', false, 'reason', prob, 'courier', nm, 'action', 'none');
  end if;
  -- remember who the customer wanted and the price they agreed to, then follow their preference
  if co.id is not null then
    select q.price into agreed from wasel_quote_price(sh.distance_km, sh.package_size, co.vehicle, sh.is_fragile, sh.cod_amount) q;
  end if;
  update wasel_shipments set dispatch_mode = 'direct', requested_courier_id = co.id,
    max_auto_price = greatest(coalesce(agreed, price), price), direct_attempts = 0
  where id = p_id;
  info := wasel__direct_fallback(p_id, prob);
  return jsonb_build_object('ok', false, 'reason', prob, 'courier', nm) || coalesce(info, '{}'::jsonb);
end $$;
grant execute on function wasel_request_courier(uuid, uuid) to authenticated;

-- ---------- courier declines a direct request → fallback ----------
create or replace function wasel_decline_offer(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments;
begin
  select * into sh from wasel_shipments where id = p_id;
  if found and sh.dispatch_mode = 'direct' and sh.requested_courier_id = auth.uid() and sh.status = 'searching'
     and exists(select 1 from wasel_shipment_offers where shipment_id = p_id and courier_id = auth.uid() and status = 'pending') then
    perform wasel__direct_fallback(p_id, 'declined');
    perform wasel_notify(sh.sender_id, 'courier_declined', sh.code, wasel_sender_link(sh));
  else
    update wasel_shipment_offers set status = 'declined' where shipment_id = p_id and courier_id = auth.uid() and status = 'pending';
  end if;
end $$;

-- ---------- no answer in time → fallback (runs on courier heartbeats, the sender's screen and pg_cron) ----------
create or replace function wasel__expand(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; s wasel_settings; timed_out boolean;
begin
  select * into sh from wasel_shipments where id = p_id;
  if sh is null or sh.status <> 'searching' then return 0; end if;
  select * into s from wasel_settings where id = 1;
  if sh.dispatch_mode = 'direct' then
    timed_out := exists(select 1 from wasel_shipment_offers where shipment_id = p_id and courier_id = sh.requested_courier_id
                        and status = 'pending' and created_at < now() - make_interval(secs => s.offer_timeout_sec));
    if timed_out then perform wasel__direct_fallback(p_id, 'no_answer'); end if;
    return 0;
  end if;
  update wasel_shipment_offers set status = 'missed' where shipment_id = p_id and status = 'pending'
    and created_at < now() - make_interval(secs => s.offer_timeout_sec);
  update wasel_shipments set dispatch_radius_km = least(dispatch_radius_km + s.radius_step_km, s.max_radius_km) where id = p_id;
  return wasel__dispatch(p_id);
end $$;
revoke execute on function wasel__expand(uuid) from public, anon, authenticated;

-- ---------- the courier accepted another delivery → his other direct requests move on at once ----------
create or replace function wasel_shipment_taken_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if old.status = 'searching' and new.status = 'accepted' and new.courier_id is not null then
    for r in select x.id from wasel_shipments x
             where x.status = 'searching' and x.dispatch_mode = 'direct' and x.requested_courier_id = new.courier_id and x.id <> new.id
               and exists(select 1 from wasel_shipment_offers o where o.shipment_id = x.id and o.courier_id = new.courier_id and o.status = 'pending')
    loop perform wasel__direct_fallback(r.id, 'taken_by_other'); end loop;
  end if;
  return new;
end $$;
drop trigger if exists wasel_shipment_taken_after on wasel_shipments;
create trigger wasel_shipment_taken_after after update of status on wasel_shipments for each row execute function wasel_shipment_taken_after();

-- ---------- the courier goes offline with a request waiting → fallback ----------
create or replace function wasel_courier_offline_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if old.is_online and not new.is_online then
    for r in select x.id from wasel_shipments x
             where x.status = 'searching' and x.dispatch_mode = 'direct' and x.requested_courier_id = new.id
               and exists(select 1 from wasel_shipment_offers o where o.shipment_id = x.id and o.courier_id = new.id and o.status = 'pending')
    loop perform wasel__direct_fallback(r.id, 'courier_offline'); end loop;
  end if;
  return new;
end $$;
drop trigger if exists wasel_courier_offline_after on wasel_couriers;
create trigger wasel_courier_offline_after after update of is_online on wasel_couriers for each row execute function wasel_courier_offline_after();

-- ---------- held couriers are hidden from other customers and from "send to all" rounds ----------
create or replace function wasel_nearby_couriers(p_lat double precision, p_lng double precision,
  p_vehicle wasel_vehicle_type default 'bike', p_limit int default 10)
returns table(id uuid, full_name text, avatar_url text, vehicle wasel_vehicle_type, vehicle_model text, vehicle_color text,
              rating numeric, rating_count int, deliveries int, distance_km numeric, lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select c.id,
         case when auth.uid() is null then split_part(p.full_name, ' ', 1) else p.full_name end,
         p.avatar_url, c.vehicle, c.vehicle_model, c.vehicle_color,
         c.rating_avg, c.rating_count, c.total_deliveries,
         round(wasel_haversine_km(p_lat, p_lng, c.lat, c.lng)::numeric, 2),
         round(c.lat::numeric, 3)::double precision, round(c.lng::numeric, 3)::double precision
  from wasel_couriers c join wasel_profiles p on p.id = c.id
  where c.is_online and c.verification = 'approved' and not p.is_blocked
    and c.lat is not null and c.last_seen_at > now() - interval '3 minutes'
    and c.id is distinct from auth.uid()
    and wasel_vehicle_rank(c.vehicle) >= wasel_vehicle_rank(p_vehicle)
    and not exists(select 1 from wasel_shipments x where x.courier_id = c.id
                   and x.status in ('accepted','arrived_pickup','picked_up','in_transit'))
    and wasel__reserved_by(c.id) is null
    and wasel_haversine_km(p_lat, p_lng, c.lat, c.lng) <= (select max_radius_km from wasel_settings where id = 1) * 1.5
  order by wasel_haversine_km(p_lat, p_lng, c.lat, c.lng)
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;
grant execute on function wasel_nearby_couriers(double precision, double precision, wasel_vehicle_type, int) to anon, authenticated;

create or replace function wasel__dispatch(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; s wasel_settings; n int := 0; c record;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or sh.status <> 'searching' or sh.dispatch_mode = 'direct' then return 0; end if;
  select * into s from wasel_settings where id = 1;
  for c in
    select co.id, wasel_haversine_km(sh.pickup_lat, sh.pickup_lng, co.lat, co.lng) as d
    from wasel_couriers co join wasel_profiles p on p.id = co.id
    where co.is_online and co.verification = 'approved' and not p.is_blocked
      and co.id is distinct from sh.sender_id
      and co.lat is not null and co.last_seen_at > now() - interval '3 minutes'
      and wasel_vehicle_rank(co.vehicle) >= wasel_vehicle_rank(sh.vehicle)
      and not exists (select 1 from wasel_shipment_offers o where o.shipment_id = sh.id and o.courier_id = co.id)
      and not exists (select 1 from wasel_shipments x where x.courier_id = co.id
                      and x.status in ('accepted','arrived_pickup','picked_up','in_transit'))
      and wasel__reserved_by(co.id, sh.id) is null
      and wasel_haversine_km(sh.pickup_lat, sh.pickup_lng, co.lat, co.lng) <= sh.dispatch_radius_km
    order by d asc
    limit s.dispatch_count
  loop
    insert into wasel_shipment_offers(shipment_id, courier_id, distance_km) values (sh.id, c.id, round(c.d::numeric, 2));
    perform wasel_notify(c.id, 'new_offer', sh.pickup_address || ' → ' || sh.dropoff_address, '/courier');
    n := n + 1;
  end loop;
  update wasel_shipments set last_dispatch_at = now(), dispatch_round = dispatch_round + 1 where id = sh.id;
  return n;
end $$;
revoke execute on function wasel__dispatch(uuid) from public, anon, authenticated;

-- heartbeat catch-up: a courier holding a direct request is not given extra "send to all" jobs meanwhile
create or replace function wasel_courier_heartbeat(p_lat double precision default null, p_lng double precision default null)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); co wasel_couriers; s wasel_settings; sh record; n int := 0; busy boolean; blocked boolean; held boolean;
begin
  if me is null then raise exception 'forbidden'; end if;
  select * into s from wasel_settings where id = 1;
  update wasel_couriers set last_seen_at = now(),
    lat = coalesce(p_lat, lat), lng = coalesce(p_lng, lng)
  where id = me returning * into co;
  if co is null then raise exception 'not_courier'; end if;
  select is_blocked into blocked from wasel_profiles where id = me;
  busy := exists(select 1 from wasel_shipments where courier_id = me and status in ('accepted','arrived_pickup','picked_up','in_transit'));

  perform wasel_dispatch_tick();
  held := wasel__reserved_by(me) is not null;

  if co.is_online and co.verification = 'approved' and not blocked and not busy and not held and co.lat is not null then
    for sh in
      select x.id, x.pickup_address, x.dropoff_address, wasel_haversine_km(x.pickup_lat, x.pickup_lng, co.lat, co.lng) d
      from wasel_shipments x
      where x.status = 'searching' and x.dispatch_mode = 'broadcast' and x.sender_id is distinct from me
        and wasel_vehicle_rank(co.vehicle) >= wasel_vehicle_rank(x.vehicle)
        and wasel_haversine_km(x.pickup_lat, x.pickup_lng, co.lat, co.lng) <= x.dispatch_radius_km
        and not exists(select 1 from wasel_shipment_offers o where o.shipment_id = x.id and o.courier_id = me
                       and (o.status in ('pending','declined','accepted','expired')
                            or (o.status = 'missed' and o.created_at > now() - interval '2 minutes')))
      order by d limit 3
    loop
      insert into wasel_shipment_offers(shipment_id, courier_id, distance_km) values (sh.id, me, round(sh.d::numeric, 2))
      on conflict (shipment_id, courier_id) do update set status = 'pending', created_at = now(), distance_km = excluded.distance_km;
      perform wasel_notify(me, 'new_offer', sh.pickup_address || ' → ' || sh.dropoff_address, '/courier');
      n := n + 1;
    end loop;
  end if;

  return json_build_object(
    'new_offers', n,
    'online', co.is_online, 'verification', co.verification, 'blocked', blocked, 'busy', busy,
    'has_location', co.lat is not null,
    'waiting_nearby', (select count(*) from wasel_shipments x where x.status = 'searching' and x.sender_id is distinct from me
                        and co.lat is not null and wasel_haversine_km(x.pickup_lat, x.pickup_lng, co.lat, co.lng) <= s.max_radius_km),
    'waiting_too_big', (select count(*) from wasel_shipments x where x.status = 'searching' and x.sender_id is distinct from me
                        and co.lat is not null and wasel_haversine_km(x.pickup_lat, x.pickup_lng, co.lat, co.lng) <= s.max_radius_km
                        and wasel_vehicle_rank(co.vehicle) < wasel_vehicle_rank(x.vehicle)),
    'max_radius_km', s.max_radius_km);
end $$;
grant execute on function wasel_courier_heartbeat(double precision, double precision) to authenticated;

-- ---------- status of a direct request for the sender's screen (now with what the system did) ----------
create or replace function wasel_direct_request(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare sh wasel_shipments; res json;
begin
  select * into sh from wasel_shipments where id = p_id;
  if sh is null or not wasel_can_see_shipment(p_id) then return null; end if;
  if sh.requested_courier_id is null then
    return case when sh.last_fallback is null then null else json_build_object('last_fallback', sh.last_fallback, 'fallback_mode', sh.fallback_mode) end;
  end if;
  select json_build_object('courier_id', c.id, 'name', p.full_name, 'avatar_url', p.avatar_url, 'vehicle', c.vehicle,
           'vehicle_model', c.vehicle_model, 'rating', c.rating_avg, 'deliveries', c.total_deliveries,
           'offer_status', o.status, 'offer_at', o.created_at,
           'fallback_mode', sh.fallback_mode, 'last_fallback', sh.last_fallback, 'attempts', sh.direct_attempts)
    into res
  from wasel_couriers c join wasel_profiles p on p.id = c.id
  left join wasel_shipment_offers o on o.shipment_id = sh.id and o.courier_id = c.id
  where c.id = sh.requested_courier_id;
  return res;
end $$;
grant execute on function wasel_direct_request(uuid) to authenticated;
