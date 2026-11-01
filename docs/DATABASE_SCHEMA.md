# Database schema (PostgreSQL / Supabase)

All objects are prefixed `wasel_` so Wasel can share a Supabase project with other apps.
Order: `supabase/schema.sql` → `migrations/002_photos_and_logos.sql` → `migrations/003_marketplace_foundation.sql`.

## Identity
- **wasel_profiles** (id = auth user, role = home role, full_name, phone, avatar_url, is_blocked)
- **wasel_user_roles** (user_id, role ∈ customer|courier|business|admin) — PK (user_id, role)

## Businesses
- **wasel_businesses** (id, owner_id, business_name, category, registration_number, email, phone, address, lat, lng, logo_url, verification)
- **wasel_business_members** (business_id, user_id, member_role ∈ owner|manager|dispatcher) — PK (business_id, user_id)
- **wasel_saved_addresses** (business_id *or* user_id, label, address, lat, lng, contact)

## Couriers
- **wasel_couriers** (id = user, vehicle, model, colour, plate, documents, verification, is_online, lat, lng, heading, last_seen_at, rating, deliveries)
- **wasel_courier_locations** (shipment_id, courier_id, lat, lng, created_at) — breadcrumb during active jobs

## Deliveries
- **wasel_shipments** — code, **delivery_type (b2c|c2c|b2b)**, **sender_id**, business_id (nullable for C2C), **recipient_business_id** (B2B),
  status, pickup/dropoff address + coordinates + contacts, package (size, description, weight, fragile, vehicle), COD, schedule,
  price snapshot (distance_km, price, platform_fee, courier_earning), tracking_token, delivery_otp, dispatch radius/round, proof photo, timestamps
- **wasel_shipment_offers** (shipment_id, courier_id, distance_km, status) — unique (shipment, courier)
- **wasel_shipment_events** — full status history
- **wasel_ratings** (shipment_id, courier_id, rater business|recipient, stars, comment)

## Finance & ops
- **wasel_ledger** (shipment, courier, business, kind: platform_fee | courier_earning | cod_collected | cod_settled | payout | adjustment, amount)
- **wasel_settings** (single row: pricing, platform fee, dispatch configuration)
- **wasel_notifications** (user_id, title key, body, link, is_read)

## Key indexes
shipments: (business_id, created_at), (courier_id, created_at), (sender_id, created_at), (recipient_business_id, created_at), status, delivery_type ·
offers: (courier_id, status) · members: user_id · businesses: owner_id · notifications: (user_id, created_at)

## Planned (see roadmap)
vehicles, vehicle_documents, business_documents, delivery_packages (photos, dimensions, category), prohibited_package_categories,
pricing_rules/zones, payments, refunds, wallets, wallet_transactions, invoices, conversations, messages, disputes, audit_logs, notification_preferences.
