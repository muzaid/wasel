-- =====================================================================
-- Wasel (واصل) — On-demand courier / shipment platform
-- Run this whole file once in Supabase → SQL Editor.
-- Every object is prefixed with wasel_ so it can share a Supabase project with other apps safely.
-- =====================================================================
create extension if not exists pgcrypto;


-- ---------- Types ----------
do $$ begin
  create type wasel_user_role as enum ('business','courier','admin');
  create type wasel_vehicle_type as enum ('bike','motorcycle','car','van');
  create type wasel_package_size as enum ('small','medium','large','xlarge');
  create type wasel_shipment_status as enum ('searching','accepted','arrived_pickup','picked_up','in_transit','delivered','cancelled','expired');
  create type wasel_offer_status as enum ('pending','accepted','declined','expired','missed');
  create type wasel_verification_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists wasel_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role wasel_user_role not null default 'business',
  full_name text not null default '',
  phone text,
  avatar_url text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists wasel_businesses (
  id uuid primary key references wasel_profiles(id) on delete cascade,
  business_name text not null default '',
  address text,
  lat double precision,
  lng double precision
);

create table if not exists wasel_couriers (
  id uuid primary key references wasel_profiles(id) on delete cascade,
  vehicle wasel_vehicle_type not null default 'motorcycle',
  vehicle_model text,
  vehicle_color text,
  plate_number text,
  id_doc_url text,
  license_doc_url text,
  verification wasel_verification_status not null default 'pending',
  is_online boolean not null default false,
  lat double precision,
  lng double precision,
  heading double precision,
  last_seen_at timestamptz,
  rating_avg numeric(3,2) not null default 5,
  rating_count int not null default 0,
  total_deliveries int not null default 0
);

create table if not exists wasel_settings (
  id int primary key default 1 check (id = 1),
  platform_fee numeric(6,2) not null default 1.50,      -- ₪ admin commission per shipment (1–2 ₪)
  base_fare numeric(6,2) not null default 10,
  per_km numeric(6,2) not null default 2.5,
  min_fare numeric(6,2) not null default 15,
  size_mult jsonb not null default '{"small":1,"medium":1.2,"large":1.5,"xlarge":2}',
  vehicle_mult jsonb not null default '{"bike":0.9,"motorcycle":1,"car":1.3,"van":1.8}',
  fragile_fee numeric(6,2) not null default 5,
  cod_fee numeric(6,2) not null default 3,
  dispatch_count int not null default 5,                -- notify nearest X couriers
  initial_radius_km numeric(5,2) not null default 3,
  radius_step_km numeric(5,2) not null default 3,
  max_radius_km numeric(5,2) not null default 20,
  offer_timeout_sec int not null default 30,
  currency text not null default 'ILS'
);
insert into wasel_settings (id) values (1) on conflict do nothing;

create table if not exists wasel_shipments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default upper(substr(md5(random()::text),1,6)),
  business_id uuid not null references wasel_businesses(id) on delete cascade,
  courier_id uuid references wasel_couriers(id),
  status wasel_shipment_status not null default 'searching',
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  pickup_contact text,
  pickup_phone text,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  recipient_name text not null,
  recipient_phone text not null,
  package_size wasel_package_size not null default 'small',
  package_desc text,
  weight_kg numeric(6,2),
  vehicle wasel_vehicle_type not null default 'motorcycle',
  is_fragile boolean not null default false,
  cod_amount numeric(10,2) not null default 0,
  notes text,
  scheduled_at timestamptz,
  distance_km numeric(8,2),
  price numeric(10,2),
  platform_fee numeric(6,2),
  courier_earning numeric(10,2),
  tracking_token text unique not null default encode(gen_random_bytes(12),'hex'),
  delivery_otp text not null default lpad((floor(random()*10000))::int::text,4,'0'),
  dispatch_radius_km numeric(5,2),
  dispatch_round int not null default 0,
  last_dispatch_at timestamptz,
  proof_photo_url text,
  cancel_reason text,
  cancelled_by wasel_user_role,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);
create index if not exists wasel_shipments_business_idx on wasel_shipments(business_id, created_at desc);
create index if not exists wasel_shipments_courier_idx on wasel_shipments(courier_id, created_at desc);
create index if not exists wasel_shipments_status_idx on wasel_shipments(status);

create table if not exists wasel_shipment_offers (
  id bigserial primary key,
  shipment_id uuid not null references wasel_shipments(id) on delete cascade,
  courier_id uuid not null references wasel_couriers(id) on delete cascade,
  distance_km numeric(8,2),
  status wasel_offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (shipment_id, courier_id)
);
create index if not exists wasel_offers_courier_idx on wasel_shipment_offers(courier_id, status);

create table if not exists wasel_shipment_events (
  id bigserial primary key,
  shipment_id uuid not null references wasel_shipments(id) on delete cascade,
  status wasel_shipment_status not null,
  note text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists wasel_courier_locations (
  id bigserial primary key,
  shipment_id uuid references wasel_shipments(id) on delete cascade,
  courier_id uuid not null references wasel_couriers(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);
create index if not exists wasel_courier_locations_ship_idx on wasel_courier_locations(shipment_id, created_at);

create table if not exists wasel_ratings (
  id bigserial primary key,
  shipment_id uuid not null references wasel_shipments(id) on delete cascade,
  courier_id uuid not null references wasel_couriers(id) on delete cascade,
  rater text not null check (rater in ('business','recipient')),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (shipment_id, rater)
);

create table if not exists wasel_ledger (
  id bigserial primary key,
  shipment_id uuid references wasel_shipments(id) on delete set null,
  courier_id uuid references wasel_couriers(id) on delete set null,
  business_id uuid references wasel_businesses(id) on delete set null,
  kind text not null check (kind in ('platform_fee','courier_earning','cod_collected','cod_settled','payout','adjustment')),
  amount numeric(10,2) not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists wasel_notifications (
  id bigserial primary key,
  user_id uuid not null references wasel_profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists wasel_notifications_user_idx on wasel_notifications(user_id, created_at desc);

create table if not exists wasel_saved_addresses (
  id bigserial primary key,
  business_id uuid not null references wasel_businesses(id) on delete cascade,
  label text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  contact_name text,
  phone text
);


-- ---------- Helpers ----------
create or replace function wasel_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from wasel_profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function wasel_haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- vehicle capacity rank: a bigger vehicle can carry a job meant for a smaller one
create or replace function wasel_vehicle_rank(v wasel_vehicle_type) returns int language sql immutable as $$
  select case v when 'bike' then 1 when 'motorcycle' then 2 when 'car' then 3 else 4 end;
$$;

create or replace function wasel_notify(p_user uuid, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into wasel_notifications(user_id, title, body, link) values (p_user, p_title, p_body, p_link);
$$;

-- Price quote (same formula is mirrored in the client for the live preview)
create or replace function wasel_quote_price(p_distance_km numeric, p_size wasel_package_size, p_vehicle wasel_vehicle_type,
                                       p_fragile boolean default false, p_cod numeric default 0)
returns table(price numeric, platform_fee numeric, courier_earning numeric)
language plpgsql stable set search_path = public as $$
declare s wasel_settings; v numeric;
begin
  select * into s from wasel_settings where id = 1;
  v := (s.base_fare + s.per_km * greatest(p_distance_km, 0))
       * coalesce((s.size_mult ->> p_size::text)::numeric, 1)
       * coalesce((s.vehicle_mult ->> p_vehicle::text)::numeric, 1);
  if p_fragile then v := v + s.fragile_fee; end if;
  if coalesce(p_cod, 0) > 0 then v := v + s.cod_fee; end if;
  v := ceil(greatest(v, s.min_fare));
  return query select v, s.platform_fee, v - s.platform_fee;
end $$;

-- ---------- New user → profile ----------
create or replace function wasel_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r wasel_user_role;
begin
  if coalesce(new.raw_user_meta_data->>'app','') <> 'wasel' then return new; end if;  -- user of another app in this project
  r := coalesce(nullif(new.raw_user_meta_data->>'role',''), 'business')::wasel_user_role;
  if r = 'admin' then r := 'business'; end if;   -- admins are promoted manually only
  insert into wasel_profiles(id, role, full_name, phone)
  values (new.id, r, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'phone');
  if r = 'business' then
    insert into wasel_businesses(id, business_name) values (new.id, coalesce(new.raw_user_meta_data->>'business_name',''));
  else
    insert into wasel_couriers(id, vehicle, plate_number, vehicle_model, vehicle_color)
    values (new.id, coalesce(nullif(new.raw_user_meta_data->>'vehicle',''),'motorcycle')::wasel_vehicle_type,
            new.raw_user_meta_data->>'plate_number', new.raw_user_meta_data->>'vehicle_model',
            new.raw_user_meta_data->>'vehicle_color');
  end if;
  return new;
end $$;
drop trigger if exists wasel_on_auth_user_created on auth.users;
create trigger wasel_on_auth_user_created after insert on auth.users for each row execute function wasel_handle_new_user();

-- Prevent users from escalating their own role / verification / stats
create or replace function wasel_guard_profile() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not wasel_is_admin() then
    new.role := old.role; new.is_blocked := old.is_blocked;
  end if;
  return new;
end $$;
drop trigger if exists wasel_guard_profile on wasel_profiles;
create trigger wasel_guard_profile before update on wasel_profiles for each row execute function wasel_guard_profile();

create or replace function wasel_guard_courier() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not wasel_is_admin() then
    new.verification := old.verification; new.rating_avg := old.rating_avg;
    new.rating_count := old.rating_count; new.total_deliveries := old.total_deliveries;
    if new.verification <> 'approved' then new.is_online := false; end if;
  end if;
  return new;
end $$;
drop trigger if exists wasel_guard_courier on wasel_couriers;
create trigger wasel_guard_courier before update on wasel_couriers for each row execute function wasel_guard_courier();

-- ---------- Shipment pricing on insert ----------
create or replace function wasel_shipment_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare q record; s wasel_settings;
begin
  select * into s from wasel_settings where id = 1;
  new.distance_km := round((wasel_haversine_km(new.pickup_lat, new.pickup_lng, new.dropoff_lat, new.dropoff_lng) * 1.3)::numeric, 2); -- road factor
  select * into q from wasel_quote_price(new.distance_km, new.package_size, new.vehicle, new.is_fragile, new.cod_amount);
  new.price := q.price; new.platform_fee := q.platform_fee; new.courier_earning := q.courier_earning;
  new.status := 'searching'; new.courier_id := null;
  new.dispatch_radius_km := s.initial_radius_km; new.dispatch_round := 0;
  return new;
end $$;
drop trigger if exists wasel_shipment_before_insert on wasel_shipments;
create trigger wasel_shipment_before_insert before insert on wasel_shipments for each row execute function wasel_shipment_before_insert();

create or replace function wasel_shipment_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into wasel_shipment_events(shipment_id, status, note) values (new.id, 'searching', 'created');
  return new;
end $$;
drop trigger if exists wasel_shipment_after_insert on wasel_shipments;
create trigger wasel_shipment_after_insert after insert on wasel_shipments for each row execute function wasel_shipment_after_insert();

-- ---------- Dispatch: find the nearest X online couriers ----------
create or replace function wasel_dispatch_shipment(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; s wasel_settings; n int := 0; c record;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null then raise exception 'not_found'; end if;
  if auth.uid() is not null and sh.business_id <> auth.uid() and not wasel_is_admin() then raise exception 'forbidden'; end if;
  if sh.status <> 'searching' then return 0; end if;
  select * into s from wasel_settings where id = 1;

  for c in
    select co.id, wasel_haversine_km(sh.pickup_lat, sh.pickup_lng, co.lat, co.lng) as d
    from wasel_couriers co join wasel_profiles p on p.id = co.id
    where co.is_online and co.verification = 'approved' and not p.is_blocked
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

-- Expand search radius and re-dispatch (called by business screen timer and/or pg_cron)
create or replace function wasel_expand_dispatch(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; s wasel_settings;
begin
  select * into sh from wasel_shipments where id = p_id;
  if sh is null or sh.status <> 'searching' then return 0; end if;
  if auth.uid() is not null and sh.business_id <> auth.uid() and not wasel_is_admin() then raise exception 'forbidden'; end if;
  select * into s from wasel_settings where id = 1;
  update wasel_shipment_offers set status = 'missed' where shipment_id = p_id and status = 'pending'
    and created_at < now() - make_interval(secs => s.offer_timeout_sec);
  update wasel_shipments set dispatch_radius_km = least(dispatch_radius_km + s.radius_step_km, s.max_radius_km) where id = p_id;
  return wasel_dispatch_shipment(p_id);
end $$;

-- Background tick: re-dispatch all stale searching shipments (schedule with pg_cron, see README)
create or replace function wasel_dispatch_tick() returns void
language plpgsql security definer set search_path = public as $$
declare r record; s wasel_settings;
begin
  select * into s from wasel_settings where id = 1;
  for r in select id from wasel_shipments where status = 'searching'
           and coalesce(last_dispatch_at, created_at) < now() - make_interval(secs => s.offer_timeout_sec)
  loop perform wasel_expand_dispatch(r.id); end loop;
  -- expire shipments nobody took in 60 minutes
  update wasel_shipments set status = 'expired' where status = 'searching' and created_at < now() - interval '60 minutes';
end $$;

-- ---------- Courier: accept / decline (first one wins) ----------
create or replace function wasel_accept_offer(p_id uuid) returns wasel_shipments
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; me uuid := auth.uid();
begin
  if not exists (select 1 from wasel_shipment_offers where shipment_id = p_id and courier_id = me and status in ('pending','missed')) then
    raise exception 'no_offer';
  end if;
  if exists (select 1 from wasel_shipments where courier_id = me and status in ('accepted','arrived_pickup','picked_up','in_transit')) then
    raise exception 'busy';
  end if;
  update wasel_shipments set courier_id = me, status = 'accepted', accepted_at = now()
   where id = p_id and status = 'searching'
   returning * into sh;
  if sh is null then raise exception 'already_taken'; end if;
  update wasel_shipment_offers set status = case when courier_id = me then 'accepted'::wasel_offer_status else 'expired'::wasel_offer_status end
   where shipment_id = p_id and status in ('pending','missed');
  insert into wasel_shipment_events(shipment_id, status) values (p_id, 'accepted');
  perform wasel_notify(sh.business_id, 'courier_assigned', sh.code, '/business/shipments/' || sh.id);
  return sh;
end $$;

create or replace function wasel_decline_offer(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update wasel_shipment_offers set status = 'declined' where shipment_id = p_id and courier_id = auth.uid() and status = 'pending';
$$;

-- ---------- Courier: status progression ----------
create or replace function wasel_advance_shipment(p_id uuid, p_status wasel_shipment_status, p_lat double precision default null,
  p_lng double precision default null, p_otp text default null, p_photo text default null) returns wasel_shipments
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; ok boolean;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or sh.courier_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  ok := (sh.status = 'accepted' and p_status = 'arrived_pickup')
     or (sh.status in ('accepted','arrived_pickup') and p_status = 'picked_up')
     or (sh.status = 'picked_up' and p_status = 'in_transit')
     or (sh.status in ('picked_up','in_transit') and p_status = 'delivered');
  if not ok then raise exception 'invalid_transition'; end if;
  if p_status = 'delivered' and coalesce(p_otp,'') <> sh.delivery_otp then raise exception 'bad_otp'; end if;

  update wasel_shipments set status = p_status,
    picked_up_at = case when p_status = 'picked_up' then now() else picked_up_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    proof_photo_url = coalesce(p_photo, proof_photo_url)
  where id = p_id returning * into sh;
  insert into wasel_shipment_events(shipment_id, status, lat, lng) values (p_id, p_status, p_lat, p_lng);
  perform wasel_notify(sh.business_id, 'status_' || p_status::text, sh.code, '/business/shipments/' || sh.id);

  if p_status = 'delivered' then
    insert into wasel_ledger(shipment_id, courier_id, business_id, kind, amount)
    values (sh.id, sh.courier_id, sh.business_id, 'platform_fee', sh.platform_fee),
           (sh.id, sh.courier_id, sh.business_id, 'courier_earning', sh.courier_earning);
    if sh.cod_amount > 0 then
      insert into wasel_ledger(shipment_id, courier_id, business_id, kind, amount)
      values (sh.id, sh.courier_id, sh.business_id, 'cod_collected', sh.cod_amount);
    end if;
    update wasel_couriers set total_deliveries = total_deliveries + 1 where id = sh.courier_id;
  end if;
  return sh;
end $$;

-- ---------- Cancel ----------
create or replace function wasel_cancel_shipment(p_id uuid, p_reason text) returns wasel_shipments
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; me uuid := auth.uid();
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null then raise exception 'not_found'; end if;
  if sh.status in ('picked_up','in_transit','delivered','cancelled','expired') and not wasel_is_admin() then
    raise exception 'cannot_cancel';
  end if;
  if sh.courier_id = me then
    -- courier backs out → shipment goes back to the pool, re-dispatched to others
    update wasel_shipments set courier_id = null, status = 'searching', accepted_at = null where id = p_id returning * into sh;
    update wasel_shipment_offers set status = 'declined' where shipment_id = p_id and courier_id = me;
    insert into wasel_shipment_events(shipment_id, status, note) values (p_id, 'searching', 'courier_cancelled: ' || coalesce(p_reason,''));
    perform wasel_notify(sh.business_id, 'courier_cancelled', sh.code, '/business/shipments/' || sh.id);
    perform wasel_dispatch_shipment(p_id);
    return sh;
  end if;
  if sh.business_id <> me and not wasel_is_admin() then raise exception 'forbidden'; end if;
  update wasel_shipments set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason,
    cancelled_by = case when wasel_is_admin() then 'admin'::wasel_user_role else 'business'::wasel_user_role end
  where id = p_id returning * into sh;
  update wasel_shipment_offers set status = 'expired' where shipment_id = p_id and status = 'pending';
  insert into wasel_shipment_events(shipment_id, status, note) values (p_id, 'cancelled', p_reason);
  if sh.courier_id is not null then perform wasel_notify(sh.courier_id, 'shipment_cancelled', sh.code, '/courier'); end if;
  return sh;
end $$;

-- ---------- Courier heartbeat / live location ----------
create or replace function wasel_update_location(p_lat double precision, p_lng double precision, p_heading double precision default null)
returns void language plpgsql security definer set search_path = public as $$
declare active uuid;
begin
  update wasel_couriers set lat = p_lat, lng = p_lng, heading = p_heading, last_seen_at = now() where id = auth.uid();
  select id into active from wasel_shipments where courier_id = auth.uid()
    and status in ('accepted','arrived_pickup','picked_up','in_transit') limit 1;
  if active is not null then
    insert into wasel_courier_locations(shipment_id, courier_id, lat, lng) values (active, auth.uid(), p_lat, p_lng);
  end if;
end $$;

-- ---------- Ratings ----------
create or replace function wasel_refresh_courier_rating(p_courier uuid) returns void
language sql security definer set search_path = public as $$
  update wasel_couriers c set rating_avg = coalesce((select round(avg(stars)::numeric, 2) from wasel_ratings where courier_id = p_courier), 5),
    rating_count = (select count(*) from wasel_ratings where courier_id = p_courier)
  where c.id = p_courier;
$$;

create or replace function wasel_rate_shipment(p_id uuid, p_stars int, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments;
begin
  select * into sh from wasel_shipments where id = p_id;
  if sh is null or sh.business_id <> auth.uid() or sh.status <> 'delivered' then raise exception 'forbidden'; end if;
  insert into wasel_ratings(shipment_id, courier_id, rater, stars, comment) values (p_id, sh.courier_id, 'business', p_stars, p_comment)
  on conflict (shipment_id, rater) do update set stars = excluded.stars, comment = excluded.comment;
  perform wasel_refresh_courier_rating(sh.courier_id);
end $$;

-- ---------- Public tracking (recipient link, no login) ----------
create or replace function wasel_get_tracking(p_token text) returns json
language plpgsql stable security definer set search_path = public as $$
declare sh wasel_shipments; res json;
begin
  select * into sh from wasel_shipments where tracking_token = p_token;
  if sh is null then return null; end if;
  select json_build_object(
    'code', sh.code, 'status', sh.status,
    'pickup', json_build_object('address', sh.pickup_address, 'lat', sh.pickup_lat, 'lng', sh.pickup_lng),
    'dropoff', json_build_object('address', sh.dropoff_address, 'lat', sh.dropoff_lat, 'lng', sh.dropoff_lng),
    'recipient_name', sh.recipient_name, 'package_size', sh.package_size, 'cod_amount', sh.cod_amount,
    'delivery_otp', case when sh.status in ('picked_up','in_transit') then sh.delivery_otp end,
    'created_at', sh.created_at, 'accepted_at', sh.accepted_at, 'picked_up_at', sh.picked_up_at, 'delivered_at', sh.delivered_at,
    'business_name', (select business_name from wasel_businesses where id = sh.business_id),
    'courier', case when sh.courier_id is not null and sh.status not in ('cancelled','expired') then (
      select json_build_object('name', p.full_name, 'phone', p.phone, 'avatar_url', p.avatar_url,
        'vehicle', c.vehicle, 'vehicle_model', c.vehicle_model, 'vehicle_color', c.vehicle_color, 'plate_number', c.plate_number,
        'rating', c.rating_avg, 'deliveries', c.total_deliveries,
        'lat', case when sh.status <> 'delivered' then c.lat end, 'lng', case when sh.status <> 'delivered' then c.lng end,
        'last_seen_at', c.last_seen_at)
      from wasel_couriers c join wasel_profiles p on p.id = c.id where c.id = sh.courier_id) end,
    'events', (select coalesce(json_agg(json_build_object('status', e.status, 'at', e.created_at) order by e.created_at), '[]'::json)
               from wasel_shipment_events e where e.shipment_id = sh.id),
    'rated', exists(select 1 from wasel_ratings where shipment_id = sh.id and rater = 'recipient')
  ) into res;
  return res;
end $$;

create or replace function wasel_rate_by_token(p_token text, p_stars int, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments;
begin
  select * into sh from wasel_shipments where tracking_token = p_token;
  if sh is null or sh.status <> 'delivered' then raise exception 'forbidden'; end if;
  insert into wasel_ratings(shipment_id, courier_id, rater, stars, comment) values (sh.id, sh.courier_id, 'recipient', p_stars, p_comment)
  on conflict (shipment_id, rater) do nothing;
  perform wasel_refresh_courier_rating(sh.courier_id);
end $$;

-- ---------- Admin ----------
create or replace function wasel_admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not wasel_is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'shipments_total', (select count(*) from wasel_shipments),
    'shipments_today', (select count(*) from wasel_shipments where created_at >= date_trunc('day', now())),
    'active', (select count(*) from wasel_shipments where status in ('searching','accepted','arrived_pickup','picked_up','in_transit')),
    'delivered', (select count(*) from wasel_shipments where status = 'delivered'),
    'cancelled', (select count(*) from wasel_shipments where status in ('cancelled','expired')),
    'revenue_total', (select coalesce(sum(amount),0) from wasel_ledger where kind = 'platform_fee'),
    'revenue_today', (select coalesce(sum(amount),0) from wasel_ledger where kind = 'platform_fee' and created_at >= date_trunc('day', now())),
    'gmv', (select coalesce(sum(price),0) from wasel_shipments where status = 'delivered'),
    'couriers_online', (select count(*) from wasel_couriers where is_online and last_seen_at > now() - interval '3 minutes'),
    'couriers_pending', (select count(*) from wasel_couriers where verification = 'pending'),
    'businesses', (select count(*) from wasel_businesses),
    'couriers', (select count(*) from wasel_couriers),
    'avg_accept_sec', (select coalesce(round(avg(extract(epoch from accepted_at - created_at))),0) from wasel_shipments where accepted_at is not null),
    'daily', (select coalesce(json_agg(d order by d.day),'[]'::json) from (
       select to_char(date_trunc('day', created_at),'MM-DD') as day, count(*) as shipments,
              count(*) filter (where status='delivered') * (select platform_fee from wasel_settings where id=1) as revenue
       from wasel_shipments where created_at > now() - interval '14 days' group by 1) d)
  );
end $$;

create or replace function wasel_courier_balance(p_courier uuid default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare cid uuid := coalesce(p_courier, auth.uid());
begin
  if cid <> auth.uid() and not wasel_is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'earnings', (select coalesce(sum(amount),0) from wasel_ledger where courier_id = cid and kind = 'courier_earning'),
    'fees_owed', (select coalesce(sum(amount),0) from wasel_ledger where courier_id = cid and kind = 'platform_fee'),
    'cod_held', (select coalesce(sum(case when kind='cod_collected' then amount when kind='cod_settled' then -amount else 0 end),0) from wasel_ledger where courier_id = cid),
    'payouts', (select coalesce(sum(amount),0) from wasel_ledger where courier_id = cid and kind = 'payout'),
    'today', (select coalesce(sum(amount),0) from wasel_ledger where courier_id = cid and kind = 'courier_earning' and created_at >= date_trunc('day', now())),
    'week', (select coalesce(sum(amount),0) from wasel_ledger where courier_id = cid and kind = 'courier_earning' and created_at >= now() - interval '7 days')
  );
end $$;

-- ---------- RLS ----------
alter table wasel_profiles enable row level security;
alter table wasel_businesses enable row level security;
alter table wasel_couriers enable row level security;
alter table wasel_settings enable row level security;
alter table wasel_shipments enable row level security;
alter table wasel_shipment_offers enable row level security;
alter table wasel_shipment_events enable row level security;
alter table wasel_courier_locations enable row level security;
alter table wasel_ratings enable row level security;
alter table wasel_ledger enable row level security;
alter table wasel_notifications enable row level security;
alter table wasel_saved_addresses enable row level security;

create or replace function wasel_can_see_shipment(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from wasel_shipments s where s.id = p_id and (
    s.business_id = auth.uid() or s.courier_id = auth.uid() or wasel_is_admin()
    or exists(select 1 from wasel_shipment_offers o where o.shipment_id = s.id and o.courier_id = auth.uid()
                and o.status in ('pending','missed','accepted'))));
$$;

create or replace function wasel_has_offer(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from wasel_shipment_offers o where o.shipment_id = p_id and o.courier_id = auth.uid()
                and o.status in ('pending','missed','accepted'));
$$;

-- related party: business ↔ courier on a shared shipment
create or replace function wasel_is_related(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from wasel_shipments s where
     (s.business_id = auth.uid() and s.courier_id = p_other) or (s.courier_id = auth.uid() and s.business_id = p_other)
     or (s.business_id = p_other and exists(select 1 from wasel_shipment_offers o where o.shipment_id = s.id and o.courier_id = auth.uid())));
$$;

drop policy if exists p_profiles_sel on wasel_profiles;
create policy p_profiles_sel on wasel_profiles for select using (id = auth.uid() or wasel_is_admin() or wasel_is_related(id));
drop policy if exists p_profiles_upd on wasel_profiles;
create policy p_profiles_upd on wasel_profiles for update using (id = auth.uid() or wasel_is_admin());

drop policy if exists p_biz_sel on wasel_businesses;
create policy p_biz_sel on wasel_businesses for select using (id = auth.uid() or wasel_is_admin() or wasel_is_related(id));
drop policy if exists p_biz_upd on wasel_businesses;
create policy p_biz_upd on wasel_businesses for update using (id = auth.uid() or wasel_is_admin());

drop policy if exists p_cour_sel on wasel_couriers;
create policy p_cour_sel on wasel_couriers for select using (id = auth.uid() or wasel_is_admin() or wasel_is_related(id));
drop policy if exists p_cour_upd on wasel_couriers;
create policy p_cour_upd on wasel_couriers for update using (id = auth.uid() or wasel_is_admin());

drop policy if exists p_settings_sel on wasel_settings;
create policy p_settings_sel on wasel_settings for select using (true);
drop policy if exists p_settings_upd on wasel_settings;
create policy p_settings_upd on wasel_settings for update using (wasel_is_admin());

drop policy if exists p_ship_sel on wasel_shipments;
create policy p_ship_sel on wasel_shipments for select using (
  business_id = auth.uid() or courier_id = auth.uid() or wasel_is_admin() or wasel_has_offer(id));
drop policy if exists p_ship_ins on wasel_shipments;
create policy p_ship_ins on wasel_shipments for insert with check (
  business_id = auth.uid() and exists(select 1 from wasel_profiles where id = auth.uid() and role = 'business' and not is_blocked));
drop policy if exists p_ship_adm on wasel_shipments;
create policy p_ship_adm on wasel_shipments for update using (wasel_is_admin());

drop policy if exists p_offers_sel on wasel_shipment_offers;
create policy p_offers_sel on wasel_shipment_offers for select using (courier_id = auth.uid() or wasel_is_admin()
  or exists(select 1 from wasel_shipments s where s.id = shipment_id and s.business_id = auth.uid()));

drop policy if exists p_events_sel on wasel_shipment_events;
create policy p_events_sel on wasel_shipment_events for select using (wasel_can_see_shipment(shipment_id));

drop policy if exists p_loc_sel on wasel_courier_locations;
create policy p_loc_sel on wasel_courier_locations for select using (courier_id = auth.uid() or (shipment_id is not null and wasel_can_see_shipment(shipment_id)));

drop policy if exists p_ratings_sel on wasel_ratings;
create policy p_ratings_sel on wasel_ratings for select using (courier_id = auth.uid() or wasel_is_admin() or wasel_can_see_shipment(shipment_id));

drop policy if exists p_ledger_sel on wasel_ledger;
create policy p_ledger_sel on wasel_ledger for select using (courier_id = auth.uid() or business_id = auth.uid() or wasel_is_admin());
drop policy if exists p_ledger_ins on wasel_ledger;
create policy p_ledger_ins on wasel_ledger for insert with check (wasel_is_admin());

drop policy if exists p_notif_sel on wasel_notifications;
create policy p_notif_sel on wasel_notifications for select using (user_id = auth.uid());
drop policy if exists p_notif_ins on wasel_notifications;
create policy p_notif_ins on wasel_notifications for insert with check (wasel_is_admin());
drop policy if exists p_notif_upd on wasel_notifications;
create policy p_notif_upd on wasel_notifications for update using (user_id = auth.uid());

drop policy if exists p_addr_all on wasel_saved_addresses;
create policy p_addr_all on wasel_saved_addresses for all using (business_id = auth.uid()) with check (business_id = auth.uid());

-- public tracking functions are callable without login
grant execute on function wasel_get_tracking(text) to anon, authenticated;
grant execute on function wasel_rate_by_token(text, int, text) to anon, authenticated;

-- ---------- Storage (proof-of-delivery photos, documents, avatars) ----------
insert into storage.buckets (id, name, public) values ('wasel-uploads', 'wasel-uploads', true) on conflict do nothing;
drop policy if exists "wasel uploads read" on storage.objects;
create policy "wasel uploads read" on storage.objects for select using (bucket_id = 'wasel-uploads');
drop policy if exists "wasel uploads write own folder" on storage.objects;
create policy "wasel uploads write own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'wasel-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Realtime ----------
do $$ begin
  alter publication supabase_realtime add table wasel_shipments, wasel_shipment_offers, wasel_shipment_events, wasel_couriers, wasel_courier_locations, wasel_notifications;
exception when others then null; end $$;

-- ---------- Optional: automatic re-dispatch every minute (enable pg_cron in Database → Extensions) ----------
-- select cron.schedule('wasel-dispatch-tick', '* * * * *', $$select wasel_dispatch_tick()$$);

-- ---------- Make yourself admin (after signing up) ----------
-- update wasel_profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
