-- =====================================================================
-- Wasel migration 006 — Uber-style courier choice + phone sign-up
--   • wasel_nearby_couriers: the 10 nearest available couriers with rating, vehicle, distance (also for guests)
--   • Direct requests: the sender picks one courier (dispatch_mode = 'direct') or sends to all ('broadcast')
--   • The sender is notified when the chosen courier declines
--   • Phone (SMS) sign-ups get their phone number on the profile
-- Run once in Supabase → SQL Editor after 005. Safe to re-run.
-- =====================================================================

alter table wasel_shipments add column if not exists dispatch_mode text not null default 'broadcast';
alter table wasel_shipments drop constraint if exists wasel_shipments_dispatch_mode_check;
alter table wasel_shipments add constraint wasel_shipments_dispatch_mode_check check (dispatch_mode in ('broadcast','direct'));
alter table wasel_shipments add column if not exists requested_courier_id uuid references wasel_couriers(id);
-- the vehicle the package needs (vehicle itself follows the chosen courier, for pricing)
alter table wasel_shipments add column if not exists required_vehicle wasel_vehicle_type;
update wasel_shipments set required_vehicle = vehicle where required_vehicle is null;
create or replace function wasel_shipment_required_vehicle() returns trigger language plpgsql as $$
begin new.required_vehicle := new.vehicle; return new; end $$;
drop trigger if exists wasel_shipment_required_vehicle on wasel_shipments;
create trigger wasel_shipment_required_vehicle before insert on wasel_shipments for each row execute function wasel_shipment_required_vehicle();

-- ---------- nearest available couriers (public card data only, location rounded to ~100 m) ----------
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
    and wasel_haversine_km(p_lat, p_lng, c.lat, c.lng) <= (select max_radius_km from wasel_settings where id = 1) * 1.5
  order by wasel_haversine_km(p_lat, p_lng, c.lat, c.lng)
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;
grant execute on function wasel_nearby_couriers(double precision, double precision, wasel_vehicle_type, int) to anon, authenticated;

-- ---------- broadcast dispatch never touches direct requests ----------
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

create or replace function wasel__expand(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; s wasel_settings;
begin
  select * into sh from wasel_shipments where id = p_id;
  if sh is null or sh.status <> 'searching' then return 0; end if;
  select * into s from wasel_settings where id = 1;
  update wasel_shipment_offers set status = 'missed' where shipment_id = p_id and status = 'pending'
    and created_at < now() - make_interval(secs => s.offer_timeout_sec);
  if sh.dispatch_mode = 'direct' then return 0; end if;     -- the sender decides what happens next
  update wasel_shipments set dispatch_radius_km = least(dispatch_radius_km + s.radius_step_km, s.max_radius_km) where id = p_id;
  return wasel__dispatch(p_id);
end $$;
revoke execute on function wasel__expand(uuid) from public, anon, authenticated;

-- ---------- sender: ask one courier ----------
create or replace function wasel_request_courier(p_id uuid, p_courier uuid) returns void
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; co wasel_couriers; q record; d numeric; v wasel_vehicle_type;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  if sh.status <> 'searching' then raise exception 'not_searching'; end if;
  select c.* into co from wasel_couriers c join wasel_profiles p on p.id = c.id
   where c.id = p_courier and c.is_online and c.verification = 'approved' and not p.is_blocked
     and c.lat is not null and c.last_seen_at > now() - interval '3 minutes' and c.id is distinct from sh.sender_id
     and wasel_vehicle_rank(c.vehicle) >= wasel_vehicle_rank(coalesce(sh.required_vehicle, sh.vehicle))
     and not exists(select 1 from wasel_shipments x where x.courier_id = c.id and x.status in ('accepted','arrived_pickup','picked_up','in_transit'));
  if co is null then raise exception 'courier_unavailable'; end if;

  -- the price follows the chosen courier's vehicle (same formula as the quote shown to the sender)
  v := co.vehicle;
  select * into q from wasel_quote_price(sh.distance_km, sh.package_size, v, sh.is_fragile, sh.cod_amount);
  d := round(wasel_haversine_km(sh.pickup_lat, sh.pickup_lng, co.lat, co.lng)::numeric, 2);

  -- withdraw other pending requests, then ask this courier
  update wasel_shipment_offers set status = 'expired' where shipment_id = p_id and status = 'pending' and courier_id <> p_courier;
  insert into wasel_shipment_offers(shipment_id, courier_id, distance_km) values (p_id, p_courier, d)
  on conflict (shipment_id, courier_id) do update set status = 'pending', created_at = now(), distance_km = excluded.distance_km;
  update wasel_shipments set dispatch_mode = 'direct', requested_courier_id = p_courier, vehicle = v,
    price = q.price, platform_fee = q.platform_fee, courier_earning = q.courier_earning,
    last_dispatch_at = now(), dispatch_round = dispatch_round + 1
  where id = p_id;
  insert into wasel_shipment_events(shipment_id, status, note) values (p_id, 'searching', 'requested_courier');
  perform wasel_notify(p_courier, 'new_offer', sh.pickup_address || ' → ' || sh.dropoff_address, '/courier');
end $$;
grant execute on function wasel_request_courier(uuid, uuid) to authenticated;

-- ---------- sender: send to all nearby couriers instead ----------
create or replace function wasel_broadcast_shipment(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; q record; v wasel_vehicle_type;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  if sh.status <> 'searching' then return 0; end if;
  -- back to the vehicle the package needs and its price
  v := coalesce(sh.required_vehicle, sh.vehicle);
  select * into q from wasel_quote_price(sh.distance_km, sh.package_size, v, sh.is_fragile, sh.cod_amount);
  -- couriers asked directly but who did not decline are asked again in the broadcast
  delete from wasel_shipment_offers where shipment_id = p_id and status in ('pending','expired','missed');
  update wasel_shipments set dispatch_mode = 'broadcast', requested_courier_id = null, vehicle = v,
    price = q.price, platform_fee = q.platform_fee, courier_earning = q.courier_earning where id = p_id;
  return wasel__dispatch(p_id);
end $$;
grant execute on function wasel_broadcast_shipment(uuid) to authenticated;

-- ---------- courier declines: tell the sender when it was a direct request ----------
create or replace function wasel_decline_offer(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments;
begin
  update wasel_shipment_offers set status = 'declined' where shipment_id = p_id and courier_id = auth.uid() and status = 'pending';
  select * into sh from wasel_shipments where id = p_id;
  if found and sh.dispatch_mode = 'direct' and sh.requested_courier_id = auth.uid() and sh.status = 'searching' then
    perform wasel_notify(sh.sender_id, 'courier_declined', sh.code, wasel_sender_link(sh));
  end if;
end $$;

-- ---------- status of a direct request, for the sender's screen ----------
create or replace function wasel_direct_request(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare sh wasel_shipments; res json;
begin
  select * into sh from wasel_shipments where id = p_id;
  if sh is null or not wasel_can_see_shipment(p_id) or sh.requested_courier_id is null then return null; end if;
  select json_build_object('courier_id', c.id, 'name', p.full_name, 'avatar_url', p.avatar_url, 'vehicle', c.vehicle,
           'vehicle_model', c.vehicle_model, 'rating', c.rating_avg, 'deliveries', c.total_deliveries,
           'offer_status', o.status, 'offer_at', o.created_at)
    into res
  from wasel_couriers c join wasel_profiles p on p.id = c.id
  left join wasel_shipment_offers o on o.shipment_id = sh.id and o.courier_id = c.id
  where c.id = sh.requested_courier_id;
  return res;
end $$;
grant execute on function wasel_direct_request(uuid) to authenticated;

-- ---------- courier heartbeat catch-up only for broadcast deliveries ----------
create or replace function wasel_courier_heartbeat(p_lat double precision default null, p_lng double precision default null)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); co wasel_couriers; s wasel_settings; sh record; n int := 0; busy boolean; blocked boolean;
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

  if co.is_online and co.verification = 'approved' and not blocked and not busy and co.lat is not null then
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

-- ---------- phone (SMS) sign-ups: keep the verified phone on the profile ----------
create or replace function wasel_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text; bid uuid; ph text;
begin
  if coalesce(new.raw_user_meta_data->>'app','') <> 'wasel' then return new; end if;  -- user of another app in this project
  r := coalesce(nullif(new.raw_user_meta_data->>'role',''), 'customer');
  if r not in ('customer','courier','business') then r := 'customer'; end if;        -- admins are promoted manually only
  ph := coalesce(nullif(new.raw_user_meta_data->>'phone',''), nullif(to_jsonb(new)->>'phone',''));
  insert into wasel_profiles(id, role, full_name, phone)
  values (new.id, r, coalesce(new.raw_user_meta_data->>'full_name',''), ph);
  insert into wasel_user_roles(user_id, role) values (new.id, 'customer'), (new.id, r) on conflict do nothing;
  if r = 'business' then
    insert into wasel_businesses(owner_id, business_name, phone)
    values (new.id, coalesce(new.raw_user_meta_data->>'business_name',''), ph)
    returning id into bid;
    insert into wasel_business_members(business_id, user_id, member_role) values (bid, new.id, 'owner');
  elsif r = 'courier' then
    insert into wasel_couriers(id, vehicle, plate_number, vehicle_model, vehicle_color)
    values (new.id, coalesce(nullif(new.raw_user_meta_data->>'vehicle',''),'motorcycle')::wasel_vehicle_type,
            new.raw_user_meta_data->>'plate_number', new.raw_user_meta_data->>'vehicle_model',
            new.raw_user_meta_data->>'vehicle_color');
  end if;
  return new;
end $$;
