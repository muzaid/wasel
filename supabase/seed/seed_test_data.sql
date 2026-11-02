-- =====================================================================
-- Wasel — TEST DATA (Israel). Run in Supabase → SQL Editor AFTER schema.sql and all migrations.
-- Safe to re-run: it first deletes everything that belongs to *@wasel.test accounts.
-- Every test account uses the password:  Wasel123!
--
--   admin@wasel.test        Admin
--   noa@wasel.test          Customer (Tel Aviv)          — personal C2C deliveries
--   yosef@wasel.test        Customer (Jerusalem)
--   lina@wasel.test         Customer (Haifa)
--   cafe@wasel.test         Business owner  — Café Dizengoff (Tel Aviv, restaurant)
--   pharma@wasel.test       Business owner  — Pharma Plus (Ramat Gan, pharmacy)
--   warehouse@wasel.test    Business owner  — Central Warehouse (Petah Tikva, supplier, B2B)
--   techhaifa@wasel.test    Business owner  — Haifa Tech Store (Haifa, retail)
--   dispatcher@wasel.test   Employee (dispatcher) of Café Dizengoff
--   avi@wasel.test          Courier, motorcycle, Tel Aviv       (approved, online)
--   omar@wasel.test         Courier, car, Ramat Gan             (approved, online)
--   dana@wasel.test         Courier, bike, Tel Aviv – Jaffa     (approved, online)
--   moshe@wasel.test        Courier, van, Jerusalem             (approved, online)
--   rami@wasel.test         Courier, motorcycle, Haifa          (approved, online)
--   eli@wasel.test          Courier, scooter→motorcycle, Netanya (PENDING verification)
-- =====================================================================
set search_path = public, extensions;

-- ---------- 0. Clean previous test data ----------
delete from wasel_shipments
 where sender_id in (select id from auth.users where email like '%@wasel.test')
    or courier_id in (select id from auth.users where email like '%@wasel.test')
    or business_id in (select b.id from wasel_businesses b join auth.users u on u.id = b.owner_id where u.email like '%@wasel.test');
delete from wasel_businesses where owner_id in (select id from auth.users where email like '%@wasel.test');
delete from auth.users where email like '%@wasel.test';

-- ---------- helpers (dropped at the end) ----------
create or replace function wasel_seed_user(p_email text, p_meta jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                         confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
          crypt('Wasel123!', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, p_meta || '{"app":"wasel"}'::jsonb,
          now() - interval '30 days', now(), '', '', '', '');
  insert into auth.identities(id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
  update wasel_profiles set created_at = now() - interval '30 days' where id = uid;
  return uid;
end $$;

create or replace function wasel_seed_ship(
  p_sender uuid, p_biz uuid, p_rbiz uuid,
  p_from text, p_flat double precision, p_flng double precision,
  p_to text, p_tlat double precision, p_tlng double precision,
  p_rname text, p_rphone text, p_size text, p_vehicle text, p_cod numeric,
  p_status text, p_courier uuid, p_hours_ago numeric, p_stars int default null, p_desc text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; t0 timestamptz := now() - make_interval(secs => p_hours_ago * 3600);
        sh wasel_shipments; st text := p_status;
begin
  insert into wasel_shipments(sender_id, business_id, recipient_business_id, pickup_address, pickup_lat, pickup_lng,
    pickup_contact, pickup_phone, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone,
    package_size, package_desc, vehicle, cod_amount, created_at)
  values (p_sender, p_biz, p_rbiz, p_from, p_flat, p_flng,
    coalesce((select business_name from wasel_businesses where id = p_biz), (select full_name from wasel_profiles where id = p_sender)),
    (select phone from wasel_profiles where id = p_sender),
    p_to, p_tlat, p_tlng, p_rname, p_rphone, p_size::wasel_package_size, p_desc, p_vehicle::wasel_vehicle_type, p_cod, t0)
  returning id into sid;
  update wasel_shipment_events set created_at = t0 where shipment_id = sid;
  update wasel_shipments set last_dispatch_at = t0, dispatch_round = 1 where id = sid;

  if st = 'cancelled' then
    update wasel_shipments set status = 'cancelled', cancelled_at = t0 + interval '4 minutes', cancel_reason = 'Customer changed plans',
      cancelled_by = case when p_biz is null then 'customer' else 'business' end where id = sid;
    insert into wasel_shipment_events(shipment_id, status, note, created_at) values (sid, 'cancelled', 'Customer changed plans', t0 + interval '4 minutes');
    return sid;
  end if;
  if st = 'searching' or p_courier is null then return sid; end if;

  insert into wasel_shipment_offers(shipment_id, courier_id, distance_km, status, created_at)
  values (sid, p_courier, 1.2, 'accepted', t0 + interval '30 seconds');
  update wasel_shipments set status = 'accepted', courier_id = p_courier, accepted_at = t0 + interval '1 minute' where id = sid;
  insert into wasel_shipment_events(shipment_id, status, created_at) values (sid, 'accepted', t0 + interval '1 minute');
  if st = 'accepted' then return sid; end if;

  insert into wasel_shipment_events(shipment_id, status, created_at) values
    (sid, 'arrived_pickup', t0 + interval '8 minutes'), (sid, 'picked_up', t0 + interval '11 minutes');
  update wasel_shipments set status = 'picked_up', picked_up_at = t0 + interval '11 minutes' where id = sid;
  if st = 'picked_up' then return sid; end if;

  insert into wasel_shipment_events(shipment_id, status, created_at) values (sid, 'in_transit', t0 + interval '12 minutes');
  update wasel_shipments set status = 'in_transit' where id = sid;
  if st = 'in_transit' then
    -- courier half-way, with a short breadcrumb trail
    insert into wasel_courier_locations(shipment_id, courier_id, lat, lng, created_at)
    select sid, p_courier, p_flat + (p_tlat - p_flat) * g / 10.0, p_flng + (p_tlng - p_flng) * g / 10.0, now() - make_interval(mins => 10 - g)
    from generate_series(0, 5) g;
    update wasel_couriers set lat = p_flat + (p_tlat - p_flat) * 0.5, lng = p_flng + (p_tlng - p_flng) * 0.5, last_seen_at = now(), is_online = true
     where id = p_courier;
    return sid;
  end if;

  -- delivered
  update wasel_shipments set status = 'delivered', delivered_at = t0 + interval '29 minutes' where id = sid returning * into sh;
  insert into wasel_shipment_events(shipment_id, status, created_at) values (sid, 'delivered', t0 + interval '29 minutes');
  insert into wasel_ledger(shipment_id, courier_id, business_id, kind, amount, created_at) values
    (sid, p_courier, p_biz, 'platform_fee', sh.platform_fee, sh.delivered_at),
    (sid, p_courier, p_biz, 'courier_earning', sh.courier_earning, sh.delivered_at);
  if p_cod > 0 then
    insert into wasel_ledger(shipment_id, courier_id, business_id, kind, amount, created_at)
    values (sid, p_courier, p_biz, 'cod_collected', p_cod, sh.delivered_at);
  end if;
  update wasel_couriers set total_deliveries = total_deliveries + 1 where id = p_courier;
  if p_stars is not null then
    insert into wasel_ratings(shipment_id, courier_id, rater, stars, comment, created_at)
    values (sid, p_courier, 'business', p_stars, case when p_stars >= 5 then 'Fast and friendly' when p_stars = 4 then 'Good' else 'A bit late' end, sh.delivered_at);
  end if;
  return sid;
end $$;

-- ---------- 1. Users, businesses, couriers ----------
do $$
declare
  u_admin uuid; u_noa uuid; u_yosef uuid; u_lina uuid;
  u_cafe uuid; u_pharma uuid; u_wh uuid; u_tech uuid; u_disp uuid;
  c_avi uuid; c_omar uuid; c_dana uuid; c_moshe uuid; c_rami uuid; c_eli uuid;
  b_cafe uuid; b_pharma uuid; b_wh uuid; b_tech uuid;
begin
  u_admin  := wasel_seed_user('admin@wasel.test',      '{"role":"customer","full_name":"Wasel Admin","phone":"050-1000000"}');
  u_noa    := wasel_seed_user('noa@wasel.test',        '{"role":"customer","full_name":"Noa Levi","phone":"052-3456789"}');
  u_yosef  := wasel_seed_user('yosef@wasel.test',      '{"role":"customer","full_name":"Yosef Cohen","phone":"054-2233445"}');
  u_lina   := wasel_seed_user('lina@wasel.test',       '{"role":"customer","full_name":"Lina Haddad","phone":"053-7788990"}');
  u_cafe   := wasel_seed_user('cafe@wasel.test',       '{"role":"business","full_name":"Tamar Shapiro","phone":"03-5250001","business_name":"Café Dizengoff"}');
  u_pharma := wasel_seed_user('pharma@wasel.test',     '{"role":"business","full_name":"David Mizrahi","phone":"03-6130002","business_name":"Pharma Plus Ramat Gan"}');
  u_wh     := wasel_seed_user('warehouse@wasel.test',  '{"role":"business","full_name":"Ronit Ben-David","phone":"03-9300003","business_name":"Central Warehouse Petah Tikva"}');
  u_tech   := wasel_seed_user('techhaifa@wasel.test',  '{"role":"business","full_name":"Samir Khoury","phone":"04-8600004","business_name":"Haifa Tech Store"}');
  u_disp   := wasel_seed_user('dispatcher@wasel.test', '{"role":"customer","full_name":"Itai Peretz","phone":"050-7654321"}');
  c_avi    := wasel_seed_user('avi@wasel.test',   '{"role":"courier","full_name":"Avi Biton","phone":"050-1112233","vehicle":"motorcycle","vehicle_model":"Yamaha NMAX","vehicle_color":"Black","plate_number":"12-345-67"}');
  c_omar   := wasel_seed_user('omar@wasel.test',  '{"role":"courier","full_name":"Omar Nasser","phone":"052-4445566","vehicle":"car","vehicle_model":"Toyota Corolla","vehicle_color":"White","plate_number":"345-67-801"}');
  c_dana   := wasel_seed_user('dana@wasel.test',  '{"role":"courier","full_name":"Dana Friedman","phone":"054-9998877","vehicle":"bike","vehicle_model":"E-bike","vehicle_color":"Green","plate_number":""}');
  c_moshe  := wasel_seed_user('moshe@wasel.test', '{"role":"courier","full_name":"Moshe Azulay","phone":"058-1239876","vehicle":"van","vehicle_model":"Ford Transit","vehicle_color":"Silver","plate_number":"78-901-23"}');
  c_rami   := wasel_seed_user('rami@wasel.test',  '{"role":"courier","full_name":"Rami Saliba","phone":"053-6547890","vehicle":"motorcycle","vehicle_model":"Honda PCX","vehicle_color":"Red","plate_number":"56-789-01"}');
  c_eli    := wasel_seed_user('eli@wasel.test',   '{"role":"courier","full_name":"Eli Dahan","phone":"050-3216549","vehicle":"motorcycle","vehicle_model":"Vespa","vehicle_color":"Blue","plate_number":"90-123-45"}');

  -- admin
  update wasel_profiles set role = 'admin' where id = u_admin;
  insert into wasel_user_roles(user_id, role) values (u_admin, 'admin') on conflict do nothing;

  -- businesses: location, category, details
  select id into b_cafe   from wasel_businesses where owner_id = u_cafe;
  select id into b_pharma from wasel_businesses where owner_id = u_pharma;
  select id into b_wh     from wasel_businesses where owner_id = u_wh;
  select id into b_tech   from wasel_businesses where owner_id = u_tech;
  update wasel_businesses set address = 'Dizengoff St 50, Tel Aviv', lat = 32.0775, lng = 34.7745, category = 'restaurant',
    email = 'cafe@wasel.test', registration_number = '515000001', verification = 'approved' where id = b_cafe;
  update wasel_businesses set address = 'Jabotinsky St 12, Ramat Gan', lat = 32.0823, lng = 34.8106, category = 'pharmacy',
    email = 'pharma@wasel.test', registration_number = '515000002', verification = 'approved' where id = b_pharma;
  update wasel_businesses set address = 'Ha-Sivim St 7, Petah Tikva', lat = 32.0985, lng = 34.8562, category = 'warehouse',
    email = 'warehouse@wasel.test', registration_number = '515000003', verification = 'approved' where id = b_wh;
  update wasel_businesses set address = 'Herzl St 20, Haifa', lat = 32.8105, lng = 34.9989, category = 'retail',
    email = 'techhaifa@wasel.test', registration_number = '515000004', verification = 'pending' where id = b_tech;

  -- employee of the café; Noa also applied as a courier (shows the account switcher)
  insert into wasel_business_members(business_id, user_id, member_role) values (b_cafe, u_disp, 'dispatcher');
  insert into wasel_user_roles(user_id, role) values (u_disp, 'business') on conflict do nothing;
  insert into wasel_user_roles(user_id, role) values (u_noa, 'courier') on conflict do nothing;
  insert into wasel_couriers(id, vehicle, vehicle_model, vehicle_color, verification) values (u_noa, 'bike', 'City bike', 'Blue', 'pending')
    on conflict do nothing;

  -- couriers: approved + online around their cities (going online in the app refreshes GPS)
  update wasel_couriers c set verification = 'approved', is_online = true, last_seen_at = now(), lat = v.lat, lng = v.lng
  from (values (c_avi, 32.0790, 34.7810), (c_omar, 32.0840, 34.8050), (c_dana, 32.0560, 34.7590),
               (c_moshe, 31.7840, 35.2130), (c_rami, 32.8120, 34.9960)) v(id, lat, lng)
  where c.id = v.id;
  update wasel_couriers set verification = 'pending', is_online = false, lat = 32.3215, lng = 34.8532 where id = c_eli;

  -- saved addresses
  insert into wasel_saved_addresses(business_id, label, address, lat, lng, contact_name, phone) values
    (b_cafe, '🏪', 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Café Dizengoff', '03-5250001'),
    (b_wh,   '🏭', 'Ha-Sivim St 7, Petah Tikva', 32.0985, 34.8562, 'Central Warehouse', '03-9300003');
  insert into wasel_saved_addresses(user_id, label, address, lat, lng, contact_name, phone) values
    (u_noa, '🏠', 'Rothschild Blvd 22, Tel Aviv', 32.0636, 34.7747, 'Noa Levi', '052-3456789'),
    (u_noa, '💼', 'Azrieli Center, Tel Aviv', 32.0744, 34.7920, 'Noa Levi', '052-3456789');

  -- ---------- 2. Deliveries over the last two weeks ----------
  -- B2C: Café Dizengoff → customers (Tel Aviv)
  perform wasel_seed_ship(u_cafe, b_cafe, null, 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Rothschild Blvd 22, Tel Aviv', 32.0636, 34.7747, 'Noa Levi', '052-3456789', 'small', 'motorcycle', 0, 'delivered', c_avi, 300, 5, 'Breakfast for two');
  perform wasel_seed_ship(u_disp, b_cafe, null, 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Ben Yehuda St 110, Tel Aviv', 32.0868, 34.7705, 'Gal Ashkenazi', '050-2223344', 'small', 'bike', 85, 'delivered', c_dana, 250, 5, 'Sandwiches + coffee');
  perform wasel_seed_ship(u_cafe, b_cafe, null, 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Jaffa Clock Tower, Tel Aviv-Yafo', 32.0548, 34.7562, 'Maya Golan', '054-1110099', 'medium', 'motorcycle', 120, 'delivered', c_avi, 190, 4, 'Office lunch order');
  perform wasel_seed_ship(u_disp, b_cafe, null, 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Azrieli Center, Tel Aviv', 32.0744, 34.7920, 'Startup Hub Ltd', '03-7000000', 'medium', 'motorcycle', 0, 'delivered', c_avi, 120, 5, 'Catering trays');
  perform wasel_seed_ship(u_cafe, b_cafe, null, 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Florentin St 10, Tel Aviv', 32.0570, 34.7690, 'Yael Bar', '052-9090909', 'small', 'bike', 0, 'cancelled', null, 72, null, 'Cake');
  perform wasel_seed_ship(u_cafe, b_cafe, null, 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Herzliya Pituach Marina', 32.1626, 34.8040, 'Oren Katz', '050-8080808', 'small', 'motorcycle', 60, 'delivered', c_omar, 30, 5, 'Dinner order');
  -- B2C: Pharma Plus → customers (Ramat Gan / Givatayim / Bnei Brak)
  perform wasel_seed_ship(u_pharma, b_pharma, null, 'Jabotinsky St 12, Ramat Gan', 32.0823, 34.8106, 'Katznelson St 30, Givatayim', 32.0700, 34.8100, 'Hana Rosen', '053-1212121', 'small', 'motorcycle', 45, 'delivered', c_omar, 280, 5, 'Prescription');
  perform wasel_seed_ship(u_pharma, b_pharma, null, 'Jabotinsky St 12, Ramat Gan', 32.0823, 34.8106, 'Rabbi Akiva St 80, Bnei Brak', 32.0870, 34.8330, 'Shlomo Weiss', '052-3434343', 'small', 'motorcycle', 0, 'delivered', c_omar, 150, 4, 'Vitamins');
  perform wasel_seed_ship(u_pharma, b_pharma, null, 'Jabotinsky St 12, Ramat Gan', 32.0823, 34.8106, 'Sokolov St 40, Holon', 32.0158, 34.7874, 'Miriam Avraham', '054-5656565', 'small', 'car', 30, 'delivered', c_omar, 50, 5, 'Baby formula');
  -- B2C: Haifa Tech Store → customers (Haifa)
  perform wasel_seed_ship(u_tech, b_tech, null, 'Herzl St 20, Haifa', 32.8105, 34.9989, 'Ben Gurion Blvd 30 (German Colony), Haifa', 32.8180, 34.9890, 'Fadi Khalil', '050-4343434', 'medium', 'motorcycle', 1200, 'delivered', c_rami, 220, 5, 'Laptop');
  perform wasel_seed_ship(u_tech, b_tech, null, 'Herzl St 20, Haifa', 32.8105, 34.9989, 'Carmel Center, Haifa', 32.8030, 34.9870, 'Shira Levy', '058-2020202', 'small', 'motorcycle', 0, 'delivered', c_rami, 96, 4, 'Headphones');
  -- B2B: Central Warehouse → Café / Pharma (stock)
  perform wasel_seed_ship(u_wh, b_wh, b_cafe, 'Ha-Sivim St 7, Petah Tikva', 32.0985, 34.8562, 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Café Dizengoff', '03-5250001', 'large', 'car', 0, 'delivered', c_omar, 260, 5, 'Coffee beans, 3 boxes');
  perform wasel_seed_ship(u_wh, b_wh, b_pharma, 'Ha-Sivim St 7, Petah Tikva', 32.0985, 34.8562, 'Jabotinsky St 12, Ramat Gan', 32.0823, 34.8106, 'Pharma Plus Ramat Gan', '03-6130002', 'xlarge', 'van', 0, 'delivered', c_moshe, 170, 4, 'Monthly restock');
  perform wasel_seed_ship(u_wh, b_wh, b_cafe, 'Ha-Sivim St 7, Petah Tikva', 32.0985, 34.8562, 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Café Dizengoff', '03-5250001', 'large', 'car', 0, 'in_transit', c_omar, 0.3, null, 'Milk & pastries');
  -- C2C: people → people
  perform wasel_seed_ship(u_noa, null, null, 'Rothschild Blvd 22, Tel Aviv', 32.0636, 34.7747, 'Herzl St 60, Rishon LeZion', 31.9730, 34.7925, 'Ella Levi', '050-6767676', 'small', 'motorcycle', 0, 'delivered', c_avi, 200, 5, 'Keys and documents');
  perform wasel_seed_ship(u_noa, null, null, 'Azrieli Center, Tel Aviv', 32.0744, 34.7920, 'Bat Yam beach promenade', 32.0170, 34.7500, 'Tom Shalev', '052-1231231', 'medium', 'motorcycle', 0, 'delivered', c_dana, 100, 4, 'Birthday gift');
  perform wasel_seed_ship(u_yosef, null, null, 'Mahane Yehuda Market, Jerusalem', 31.7853, 35.2120, 'Emek Refaim St 40 (German Colony), Jerusalem', 31.7637, 35.2194, 'Rivka Cohen', '054-4545454', 'medium', 'van', 0, 'delivered', c_moshe, 140, 5, 'Shabbat groceries for mom');
  perform wasel_seed_ship(u_yosef, null, null, 'Jaffa St 100, Jerusalem', 31.7840, 35.2150, 'Malha Mall, Jerusalem', 31.7517, 35.1875, 'Avi Cohen', '050-9898989', 'small', 'van', 0, 'accepted', c_moshe, 0.1, null, 'Laptop charger');
  perform wasel_seed_ship(u_lina, null, null, 'Hadar, Haifa', 32.8105, 34.9989, 'Ben Gurion University, Be''er Sheva', 31.2620, 34.8010, 'Karim Haddad', '053-3030303', 'small', 'car', 0, 'cancelled', null, 48, null, 'Books');
  perform wasel_seed_ship(u_lina, null, null, 'Carmel Center, Haifa', 32.8030, 34.9870, 'Wadi Nisnas, Haifa', 32.8150, 34.9950, 'Samia Haddad', '058-6060606', 'small', 'motorcycle', 0, 'delivered', c_rami, 24, 5, 'Home-made food');
  -- live requests waiting for a courier (open the business/customer screen to see the radar)
  perform wasel_seed_ship(u_cafe, b_cafe, null, 'Dizengoff St 50, Tel Aviv', 32.0775, 34.7745, 'Ibn Gabirol St 120, Tel Aviv', 32.0880, 34.7820, 'Lior Hadad', '050-1414141', 'small', 'motorcycle', 50, 'searching', null, 0.02, null, 'Brunch');
  perform wasel_seed_ship(u_noa, null, null, 'Rothschild Blvd 22, Tel Aviv', 32.0636, 34.7747, 'Ramat Aviv Mall, Tel Aviv', 32.1120, 34.7960, 'Dor Mizrahi', '052-5151515', 'small', 'bike', 0, 'searching', null, 0.01, null, 'Forgotten phone charger');

  perform wasel_refresh_courier_rating(c) from unnest(array[c_avi, c_omar, c_dana, c_moshe, c_rami]) c;

  -- a few unread notifications so the bell is not empty
  insert into wasel_notifications(user_id, title, body, link) values
    (u_cafe, 'status_in_transit', 'Incoming stock is on the way', '/business'),
    (u_noa, 'courier_assigned', 'Welcome to Wasel 👋', '/customer'),
    (u_disp, 'business_invite', 'Café Dizengoff', '/business');
end $$;

-- Supabase Auth fails to log in users whose token columns are NULL ("Database error querying schema"): make them ''
do $$ declare c text; begin
  foreach c in array array['confirmation_token','recovery_token','email_change_token_new','email_change_token_current',
                           'email_change','phone_change','phone_change_token','reauthentication_token'] loop
    if exists(select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = c) then
      execute format('update auth.users set %I = '''' where %I is null and email like ''%%@wasel.test''', c, c);
    end if;
  end loop;
end $$;

-- your own account becomes admin too, if you already signed up with it
do $$ begin
  if exists(select 1 from auth.users where lower(email) = 'muhammad.zaid86@gmail.com') then
    perform wasel_make_admin('muhammad.zaid86@gmail.com');
  end if;
end $$;

drop function wasel_seed_ship(uuid, uuid, uuid, text, double precision, double precision, text, double precision, double precision, text, text, text, text, numeric, text, uuid, numeric, int, text);
drop function wasel_seed_user(text, jsonb);

select 'Seeded: ' || (select count(*) from wasel_profiles p join auth.users u on u.id = p.id where u.email like '%@wasel.test') || ' users, '
  || (select count(*) from wasel_shipments s join auth.users u on u.id = s.sender_id where u.email like '%@wasel.test') || ' deliveries. Password for all: Wasel123!' as result;
