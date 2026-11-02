-- =====================================================================
-- Wasel migration 004 — couriers reliably receive new deliveries
--   • Heartbeat that does not depend on a fresh GPS fix (desktop / weak GPS couriers stayed "stale")
--   • Catch-up: a courier who comes online (or is near a waiting delivery) gets it without the sender re-dispatching
--   • Widening the search radius runs on every courier heartbeat, so it works even without pg_cron
--   • Status JSON for the courier screen: why am I not getting jobs?
-- Run once in Supabase → SQL Editor after 003. Safe to re-run.
-- =====================================================================

-- ---------- internal dispatch (no caller check; not callable from the API) ----------
create or replace function wasel__dispatch(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; s wasel_settings; n int := 0; c record;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or sh.status <> 'searching' then return 0; end if;
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

create or replace function wasel__expand(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; s wasel_settings;
begin
  select * into sh from wasel_shipments where id = p_id;
  if sh is null or sh.status <> 'searching' then return 0; end if;
  select * into s from wasel_settings where id = 1;
  update wasel_shipment_offers set status = 'missed' where shipment_id = p_id and status = 'pending'
    and created_at < now() - make_interval(secs => s.offer_timeout_sec);
  update wasel_shipments set dispatch_radius_km = least(dispatch_radius_km + s.radius_step_km, s.max_radius_km) where id = p_id;
  return wasel__dispatch(p_id);
end $$;

revoke execute on function wasel__dispatch(uuid) from public, anon, authenticated;
revoke execute on function wasel__expand(uuid) from public, anon, authenticated;

-- public wrappers keep the permission check for senders
create or replace function wasel_dispatch_shipment(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from wasel_shipments where id = p_id) then raise exception 'not_found'; end if;
  if auth.uid() is not null and not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  return wasel__dispatch(p_id);
end $$;

create or replace function wasel_expand_dispatch(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  return wasel__expand(p_id);
end $$;

-- widening rounds for every waiting delivery (pg_cron and courier heartbeats call this)
create or replace function wasel_dispatch_tick() returns void
language plpgsql security definer set search_path = public as $$
declare r record; s wasel_settings;
begin
  select * into s from wasel_settings where id = 1;
  for r in select id from wasel_shipments where status = 'searching'
           and coalesce(last_dispatch_at, created_at) < now() - make_interval(secs => s.offer_timeout_sec)
  loop perform wasel__expand(r.id); end loop;
  update wasel_shipments set status = 'expired' where status = 'searching' and created_at < now() - interval '60 minutes';
end $$;

-- ---------- courier heartbeat + catch-up ----------
-- Called by the courier app every ~20 s while online (with or without a GPS fix).
-- Returns what the courier screen needs to explain why offers do / do not arrive.
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

  perform wasel_dispatch_tick();   -- keeps every waiting delivery widening its radius, even without pg_cron

  if co.is_online and co.verification = 'approved' and not blocked and not busy and co.lat is not null then
    for sh in
      select x.id, x.pickup_address, x.dropoff_address, wasel_haversine_km(x.pickup_lat, x.pickup_lng, co.lat, co.lng) d
      from wasel_shipments x
      where x.status = 'searching' and x.sender_id is distinct from me
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
