-- =====================================================================
-- Wasel migration 003 — Marketplace foundation (Phase 1)
--   • Unified identity: one account, many roles (customer / courier / business / admin)
--   • Businesses are real entities with members (owner / manager / dispatcher)
--   • Delivery relationships B2C, C2C, B2B — derived on the server, never trusted from the client
-- Run once in Supabase → SQL Editor after schema.sql and 002. Safe to re-run.
-- =====================================================================

-- ---------- 1. Roles: profile.role becomes the "home" role; all roles live in wasel_user_roles ----------
drop policy if exists p_ship_ins on wasel_shipments;   -- depends on wasel_profiles.role, recreated below
do $$ begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'wasel_profiles' and column_name = 'role') <> 'text' then
    alter table wasel_profiles alter column role drop default;
    alter table wasel_profiles alter column role type text using role::text;
  end if;
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'wasel_shipments' and column_name = 'cancelled_by') <> 'text' then
    alter table wasel_shipments alter column cancelled_by type text using cancelled_by::text;
  end if;
end $$;
alter table wasel_profiles alter column role set default 'customer';
alter table wasel_profiles drop constraint if exists wasel_profiles_role_check;
alter table wasel_profiles add constraint wasel_profiles_role_check check (role in ('customer','courier','business','admin'));

create table if not exists wasel_user_roles (
  user_id uuid not null references wasel_profiles(id) on delete cascade,
  role text not null check (role in ('customer','courier','business','admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
insert into wasel_user_roles(user_id, role) select id, role from wasel_profiles on conflict do nothing;
insert into wasel_user_roles(user_id, role) select id, 'customer' from wasel_profiles on conflict do nothing; -- everyone can send

create or replace function wasel_has_role(p_role text, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from wasel_user_roles where user_id = p_user and role = p_role);
$$;

create or replace function wasel_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from wasel_user_roles where user_id = auth.uid() and role = 'admin')
      or exists(select 1 from wasel_profiles where id = auth.uid() and role = 'admin');
$$;

-- Run from the SQL editor only:  select wasel_make_admin('you@example.com');
create or replace function wasel_make_admin(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No user with email %', p_email; end if;
  insert into wasel_profiles(id, role, full_name) values (uid, 'admin', 'Admin') on conflict (id) do update set role = 'admin';
  insert into wasel_user_roles(user_id, role) values (uid, 'admin'), (uid, 'customer') on conflict do nothing;
  return 'ok: ' || p_email || ' is now admin';
end $$;
revoke execute on function wasel_make_admin(text) from public, anon, authenticated;

-- Users may switch their home role only to a role they actually hold
create or replace function wasel_guard_profile() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not wasel_is_admin() then
    new.is_blocked := old.is_blocked;
    if new.role is distinct from old.role and not wasel_has_role(new.role, new.id) then new.role := old.role; end if;
  end if;
  return new;
end $$;

-- Self-service roles (business is created through wasel_create_business)
create or replace function wasel_add_role(p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'forbidden'; end if;
  if p_role not in ('customer','courier') then raise exception 'invalid_role'; end if;
  insert into wasel_user_roles(user_id, role) values (me, p_role) on conflict do nothing;
  if p_role = 'courier' then insert into wasel_couriers(id) values (me) on conflict do nothing; end if;
end $$;

alter table wasel_user_roles enable row level security;
drop policy if exists p_roles_sel on wasel_user_roles;
create policy p_roles_sel on wasel_user_roles for select using (user_id = auth.uid() or wasel_is_admin());
drop policy if exists p_roles_adm on wasel_user_roles;
create policy p_roles_adm on wasel_user_roles for all using (wasel_is_admin()) with check (wasel_is_admin());

-- ---------- 2. Businesses as entities + members ----------
alter table wasel_businesses drop constraint if exists wasel_businesses_id_fkey;
alter table wasel_businesses alter column id set default gen_random_uuid();
alter table wasel_businesses add column if not exists owner_id uuid references wasel_profiles(id) on delete cascade;
update wasel_businesses set owner_id = id where owner_id is null;   -- before 003 the business id was the owner's user id
alter table wasel_businesses add column if not exists category text;
alter table wasel_businesses add column if not exists registration_number text;
alter table wasel_businesses add column if not exists email text;
alter table wasel_businesses add column if not exists phone text;
alter table wasel_businesses add column if not exists verification text not null default 'pending';
alter table wasel_businesses drop constraint if exists wasel_businesses_verification_check;
alter table wasel_businesses add constraint wasel_businesses_verification_check check (verification in ('pending','approved','rejected'));
alter table wasel_businesses add column if not exists created_at timestamptz not null default now();
create index if not exists wasel_businesses_owner_idx on wasel_businesses(owner_id);

create table if not exists wasel_business_members (
  business_id uuid not null references wasel_businesses(id) on delete cascade,
  user_id uuid not null references wasel_profiles(id) on delete cascade,
  member_role text not null default 'dispatcher' check (member_role in ('owner','manager','dispatcher')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists wasel_business_members_user_idx on wasel_business_members(user_id);
insert into wasel_business_members(business_id, user_id, member_role)
  select id, owner_id, 'owner' from wasel_businesses where owner_id is not null on conflict do nothing;
insert into wasel_user_roles(user_id, role) select user_id, 'business' from wasel_business_members on conflict do nothing;

create or replace function wasel_member_rank(r text) returns int language sql immutable as $$
  select case r when 'owner' then 3 when 'manager' then 2 when 'dispatcher' then 1 else 0 end;
$$;

create or replace function wasel_is_member(p_business uuid, p_min text default 'dispatcher') returns boolean
language sql stable security definer set search_path = public as $$
  select p_business is not null and exists(
    select 1 from wasel_business_members m
    where m.business_id = p_business and m.user_id = auth.uid()
      and wasel_member_rank(m.member_role) >= wasel_member_rank(p_min));
$$;

create or replace function wasel_create_business(p_name text, p_category text default null, p_phone text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bid uuid;
begin
  if me is null then raise exception 'forbidden'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  insert into wasel_businesses(owner_id, business_name, category, phone) values (me, trim(p_name), p_category, p_phone) returning id into bid;
  insert into wasel_business_members(business_id, user_id, member_role) values (bid, me, 'owner');
  insert into wasel_user_roles(user_id, role) values (me, 'business') on conflict do nothing;
  return bid;
end $$;

-- Invite an existing Wasel user (by email) into a business
create or replace function wasel_add_member(p_business uuid, p_email text, p_role text default 'dispatcher') returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not wasel_is_member(p_business, 'manager') then raise exception 'forbidden'; end if;
  if p_role not in ('manager','dispatcher') then raise exception 'invalid_role'; end if;
  if p_role = 'manager' and not wasel_is_member(p_business, 'owner') then raise exception 'forbidden'; end if;
  select u.id into uid from auth.users u join wasel_profiles p on p.id = u.id where lower(u.email) = lower(trim(p_email));
  if uid is null then raise exception 'user_not_found'; end if;
  insert into wasel_business_members(business_id, user_id, member_role) values (p_business, uid, p_role)
    on conflict (business_id, user_id) do update set member_role = excluded.member_role
    where wasel_business_members.member_role <> 'owner';
  insert into wasel_user_roles(user_id, role) values (uid, 'business') on conflict do nothing;
  perform wasel_notify(uid, 'business_invite', (select business_name from wasel_businesses where id = p_business), '/business');
end $$;

create or replace function wasel_remove_member(p_business uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not wasel_is_member(p_business, 'manager') and p_user <> auth.uid() then raise exception 'forbidden'; end if;
  delete from wasel_business_members where business_id = p_business and user_id = p_user and member_role <> 'owner';
end $$;

create or replace function wasel_business_team(p_business uuid)
returns table(user_id uuid, full_name text, email text, phone text, avatar_url text, member_role text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not wasel_is_member(p_business) and not wasel_is_admin() then raise exception 'forbidden'; end if;
  return query
    select m.user_id, p.full_name, u.email::text, p.phone, p.avatar_url, m.member_role, m.created_at
    from wasel_business_members m join wasel_profiles p on p.id = m.user_id join auth.users u on u.id = m.user_id
    where m.business_id = p_business
    order by wasel_member_rank(m.member_role) desc, m.created_at;
end $$;

-- B2B: find a receiving business on the platform (limited public fields)
create or replace function wasel_search_businesses(p_q text default '')
returns table(id uuid, business_name text, logo_url text, address text, lat double precision, lng double precision, phone text)
language sql stable security definer set search_path = public as $$
  select b.id, b.business_name, b.logo_url, b.address, b.lat, b.lng, b.phone
  from wasel_businesses b
  where auth.uid() is not null and b.lat is not null and b.verification <> 'rejected'
    and b.business_name ilike '%' || coalesce(p_q, '') || '%'
  order by b.business_name limit 20;
$$;

-- Owners/verification can only be changed by admins
create or replace function wasel_guard_business() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not wasel_is_admin() then
    new.id := old.id; new.owner_id := old.owner_id; new.verification := old.verification;
  end if;
  return new;
end $$;
drop trigger if exists wasel_guard_business on wasel_businesses;
create trigger wasel_guard_business before update on wasel_businesses for each row execute function wasel_guard_business();

alter table wasel_business_members enable row level security;
drop policy if exists p_members_sel on wasel_business_members;
create policy p_members_sel on wasel_business_members for select
  using (user_id = auth.uid() or wasel_is_member(business_id) or wasel_is_admin());

-- ---------- 3. Shipments: sender, delivery type, receiving business ----------
alter table wasel_shipments add column if not exists sender_id uuid references wasel_profiles(id);
update wasel_shipments set sender_id = business_id where sender_id is null;
alter table wasel_shipments alter column business_id drop not null;
alter table wasel_shipments add column if not exists recipient_business_id uuid references wasel_businesses(id);
alter table wasel_shipments add column if not exists delivery_type text not null default 'b2c';
alter table wasel_shipments drop constraint if exists wasel_shipments_delivery_type_check;
alter table wasel_shipments add constraint wasel_shipments_delivery_type_check check (delivery_type in ('b2c','c2c','b2b'));
create index if not exists wasel_shipments_sender_idx on wasel_shipments(sender_id, created_at desc);
create index if not exists wasel_shipments_rbiz_idx on wasel_shipments(recipient_business_id, created_at desc);
create index if not exists wasel_shipments_type_idx on wasel_shipments(delivery_type);

create or replace function wasel_shipment_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare q record; s wasel_settings;
begin
  select * into s from wasel_settings where id = 1;
  new.sender_id := coalesce(auth.uid(), new.sender_id);
  -- relationship is derived from who sends and who receives, never from the client
  if new.business_id is null then
    new.recipient_business_id := null; new.delivery_type := 'c2c';
  elsif new.recipient_business_id is not null then
    new.delivery_type := 'b2b';
  else
    new.delivery_type := 'b2c';
  end if;
  new.distance_km := round((wasel_haversine_km(new.pickup_lat, new.pickup_lng, new.dropoff_lat, new.dropoff_lng) * 1.3)::numeric, 2);
  select * into q from wasel_quote_price(new.distance_km, new.package_size, new.vehicle, new.is_fragile, new.cod_amount);
  new.price := q.price; new.platform_fee := q.platform_fee; new.courier_earning := q.courier_earning;
  new.status := 'searching'; new.courier_id := null;
  new.dispatch_radius_km := s.initial_radius_km; new.dispatch_round := 0;
  return new;
end $$;

create or replace function wasel_can_manage_shipment(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from wasel_shipments s where s.id = p_id and (
    s.sender_id = auth.uid() or wasel_is_member(s.business_id, 'dispatcher') or wasel_is_admin()));
$$;

create or replace function wasel_can_see_shipment(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from wasel_shipments s where s.id = p_id and (
    s.sender_id = auth.uid() or s.courier_id = auth.uid() or wasel_is_admin()
    or wasel_is_member(s.business_id) or wasel_is_member(s.recipient_business_id)
    or exists(select 1 from wasel_shipment_offers o where o.shipment_id = s.id and o.courier_id = auth.uid()
              and o.status in ('pending','missed','accepted'))));
$$;

create or replace function wasel_is_related(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from wasel_shipments s where
       ((s.sender_id = auth.uid() or wasel_is_member(s.business_id)) and s.courier_id = p_other)
    or (s.courier_id = auth.uid() and (s.sender_id = p_other or s.business_id = p_other))
    or ((s.sender_id = p_other or s.business_id = p_other)
        and exists(select 1 from wasel_shipment_offers o where o.shipment_id = s.id and o.courier_id = auth.uid())));
$$;

drop policy if exists p_biz_sel on wasel_businesses;
create policy p_biz_sel on wasel_businesses for select using (wasel_is_member(id) or wasel_is_admin() or wasel_is_related(id));
drop policy if exists p_biz_upd on wasel_businesses;
create policy p_biz_upd on wasel_businesses for update using (wasel_is_member(id, 'manager') or wasel_is_admin());

drop policy if exists p_ship_sel on wasel_shipments;
create policy p_ship_sel on wasel_shipments for select using (
  sender_id = auth.uid() or courier_id = auth.uid() or wasel_is_admin() or wasel_has_offer(id)
  or wasel_is_member(business_id) or wasel_is_member(recipient_business_id));
create policy p_ship_ins on wasel_shipments for insert with check (
  sender_id = auth.uid()
  and not exists(select 1 from wasel_profiles where id = auth.uid() and is_blocked)
  and ((business_id is null and wasel_has_role('customer')) or wasel_is_member(business_id, 'dispatcher')));

drop policy if exists p_ledger_sel on wasel_ledger;
create policy p_ledger_sel on wasel_ledger for select using (
  courier_id = auth.uid() or wasel_is_member(business_id) or wasel_is_admin()
  or exists(select 1 from wasel_shipments s where s.id = shipment_id and s.sender_id = auth.uid()));

-- Saved addresses for individuals as well as businesses
alter table wasel_saved_addresses add column if not exists user_id uuid references wasel_profiles(id) on delete cascade;
alter table wasel_saved_addresses alter column business_id drop not null;
drop policy if exists p_addr_all on wasel_saved_addresses;
create policy p_addr_all on wasel_saved_addresses for all
  using (user_id = auth.uid() or wasel_is_member(business_id))
  with check (user_id = auth.uid() or wasel_is_member(business_id));

-- ---------- 4. Engine functions updated for senders / members ----------
create or replace function wasel_dispatch_shipment(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; s wasel_settings; n int := 0; c record;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null then raise exception 'not_found'; end if;
  if auth.uid() is not null and not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  if sh.status <> 'searching' then return 0; end if;
  select * into s from wasel_settings where id = 1;
  for c in
    select co.id, wasel_haversine_km(sh.pickup_lat, sh.pickup_lng, co.lat, co.lng) as d
    from wasel_couriers co join wasel_profiles p on p.id = co.id
    where co.is_online and co.verification = 'approved' and not p.is_blocked
      and co.id is distinct from sh.sender_id                      -- a courier never receives their own request
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

create or replace function wasel_expand_dispatch(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; s wasel_settings;
begin
  select * into sh from wasel_shipments where id = p_id;
  if sh is null or sh.status <> 'searching' then return 0; end if;
  if auth.uid() is not null and not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  select * into s from wasel_settings where id = 1;
  update wasel_shipment_offers set status = 'missed' where shipment_id = p_id and status = 'pending'
    and created_at < now() - make_interval(secs => s.offer_timeout_sec);
  update wasel_shipments set dispatch_radius_km = least(dispatch_radius_km + s.radius_step_km, s.max_radius_km) where id = p_id;
  return wasel_dispatch_shipment(p_id);
end $$;

-- link for the sender: business deliveries open in the business app, personal ones in the customer app
create or replace function wasel_sender_link(sh wasel_shipments) returns text language sql immutable as $$
  select case when sh.business_id is null then '/customer/shipments/' else '/business/shipments/' end || sh.id;
$$;

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
  perform wasel_notify(sh.sender_id, 'courier_assigned', sh.code, wasel_sender_link(sh));
  return sh;
end $$;

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
  perform wasel_notify(sh.sender_id, 'status_' || p_status::text, sh.code, wasel_sender_link(sh));
  -- B2B: keep the receiving business informed
  if sh.recipient_business_id is not null and p_status in ('picked_up','delivered') then
    perform wasel_notify(m.user_id, 'incoming_' || p_status::text, sh.code, '/business')
    from wasel_business_members m where m.business_id = sh.recipient_business_id and m.member_role in ('owner','manager');
  end if;

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
    update wasel_shipments set courier_id = null, status = 'searching', accepted_at = null where id = p_id returning * into sh;
    update wasel_shipment_offers set status = 'declined' where shipment_id = p_id and courier_id = me;
    insert into wasel_shipment_events(shipment_id, status, note) values (p_id, 'searching', 'courier_cancelled: ' || coalesce(p_reason,''));
    perform wasel_notify(sh.sender_id, 'courier_cancelled', sh.code, wasel_sender_link(sh));
    perform wasel_dispatch_shipment(p_id);
    return sh;
  end if;
  if not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  update wasel_shipments set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason,
    cancelled_by = case when wasel_is_admin() then 'admin' when sh.business_id is null then 'customer' else 'business' end
  where id = p_id returning * into sh;
  update wasel_shipment_offers set status = 'expired' where shipment_id = p_id and status = 'pending';
  insert into wasel_shipment_events(shipment_id, status, note) values (p_id, 'cancelled', p_reason);
  if sh.courier_id is not null then perform wasel_notify(sh.courier_id, 'shipment_cancelled', sh.code, '/courier'); end if;
  return sh;
end $$;

create or replace function wasel_rate_shipment(p_id uuid, p_stars int, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments;
begin
  select * into sh from wasel_shipments where id = p_id;
  if sh is null or not wasel_can_manage_shipment(p_id) or sh.status <> 'delivered' then raise exception 'forbidden'; end if;
  insert into wasel_ratings(shipment_id, courier_id, rater, stars, comment) values (p_id, sh.courier_id, 'business', p_stars, p_comment)
  on conflict (shipment_id, rater) do update set stars = excluded.stars, comment = excluded.comment;
  perform wasel_refresh_courier_rating(sh.courier_id);
end $$;

create or replace function wasel_get_tracking(p_token text) returns json
language plpgsql stable security definer set search_path = public as $$
declare sh wasel_shipments; res json;
begin
  select * into sh from wasel_shipments where tracking_token = p_token;
  if sh is null then return null; end if;
  select json_build_object(
    'code', sh.code, 'status', sh.status, 'delivery_type', sh.delivery_type,
    'pickup', json_build_object('address', sh.pickup_address, 'lat', sh.pickup_lat, 'lng', sh.pickup_lng),
    'dropoff', json_build_object('address', sh.dropoff_address, 'lat', sh.dropoff_lat, 'lng', sh.dropoff_lng),
    'recipient_name', sh.recipient_name, 'package_size', sh.package_size, 'cod_amount', sh.cod_amount,
    'delivery_otp', case when sh.status in ('picked_up','in_transit') then sh.delivery_otp end,
    'created_at', sh.created_at, 'accepted_at', sh.accepted_at, 'picked_up_at', sh.picked_up_at, 'delivered_at', sh.delivered_at,
    'business_name', coalesce((select business_name from wasel_businesses where id = sh.business_id),
                              (select full_name from wasel_profiles where id = sh.sender_id)),
    'business_logo', coalesce((select logo_url from wasel_businesses where id = sh.business_id),
                              (select avatar_url from wasel_profiles where id = sh.sender_id)),
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
grant execute on function wasel_get_tracking(text) to anon, authenticated;

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
    'users', (select count(*) from wasel_profiles),
    'b2c', (select count(*) from wasel_shipments where delivery_type = 'b2c'),
    'c2c', (select count(*) from wasel_shipments where delivery_type = 'c2c'),
    'b2b', (select count(*) from wasel_shipments where delivery_type = 'b2b'),
    'avg_accept_sec', (select coalesce(round(avg(extract(epoch from accepted_at - created_at))),0) from wasel_shipments where accepted_at is not null),
    'daily', (select coalesce(json_agg(d order by d.day),'[]'::json) from (
       select to_char(date_trunc('day', created_at),'MM-DD') as day, count(*) as shipments,
              count(*) filter (where status='delivered') * (select platform_fee from wasel_settings where id=1) as revenue
       from wasel_shipments where created_at > now() - interval '14 days' group by 1) d)
  );
end $$;

-- ---------- 5. Sign-up: customer, courier or business, all on one identity ----------
create or replace function wasel_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text; bid uuid;
begin
  if coalesce(new.raw_user_meta_data->>'app','') <> 'wasel' then return new; end if;  -- user of another app in this project
  r := coalesce(nullif(new.raw_user_meta_data->>'role',''), 'customer');
  if r not in ('customer','courier','business') then r := 'customer'; end if;        -- admins are promoted manually only
  insert into wasel_profiles(id, role, full_name, phone)
  values (new.id, r, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'phone');
  insert into wasel_user_roles(user_id, role) values (new.id, 'customer'), (new.id, r) on conflict do nothing;
  if r = 'business' then
    insert into wasel_businesses(owner_id, business_name, phone)
    values (new.id, coalesce(new.raw_user_meta_data->>'business_name',''), new.raw_user_meta_data->>'phone')
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

-- ---------- 6. Realtime for the new tables ----------
do $$ begin
  alter publication supabase_realtime add table wasel_business_members;
exception when others then null; end $$;
