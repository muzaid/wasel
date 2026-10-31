-- Wasel migration 002 — business logos (user photos already use wasel_profiles.avatar_url)
-- Run once in Supabase → SQL Editor, after schema.sql. Safe to run more than once.

alter table wasel_businesses add column if not exists logo_url text;

-- Tracking link now also returns the sender's logo
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
    'business_logo', (select logo_url from wasel_businesses where id = sh.business_id),
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
