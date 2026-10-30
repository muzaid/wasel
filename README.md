# Wasel · واصل — Courier on demand

Uber-style dispatch for **shipments**. A business posts a shipment → the app alerts the **nearest X online couriers** → the **first to accept** gets it at a **fixed upfront price** → the recipient gets a **live tracking link** with the courier's location, name, rating and vehicle. The platform (admin) earns a configurable **1–2 ₪ per delivered shipment**.

Arabic-first (RTL) with English & Hebrew, installable as a PWA on Android/iOS.

## Features

**Business**
- Post a shipment: pickup/drop-off by map tap, address search or GPS, saved addresses
- Package size, minimum vehicle (bike / motorcycle / car / van), weight, fragile, notes, scheduling
- **Cash on delivery (COD)** amount collected by the courier
- Instant price quote before posting (base + per-km × size × vehicle multipliers)
- Live search screen: radius circle, couriers notified, auto-widening radius
- Live map of the courier (breadcrumb trail), ETA, courier card (photo, rating, vehicle, plate, call)
- Share tracking link via **WhatsApp / SMS / copy**
- 4-digit **delivery code (OTP)** and proof-of-delivery photo
- Cancel (before pickup), rate courier, history with search/filter, **CSV export**

**Courier**
- Online/offline toggle, background GPS streaming + heartbeat
- Incoming job sheet with sound/vibration, countdown, earnings, distance, COD → accept / decline
- First-accept-wins (atomic; others get "already taken")
- Step flow: arrived at pickup → picked up → on the way → delivered (OTP + photo)
- Google Maps / Waze navigation, call sender/recipient
- Earnings (today / week / all), platform fees, cash-on-hand, ledger
- Profile, vehicle details, document upload (ID, license, photo) for verification
- Backing out before pickup returns the job to the pool and re-dispatches it

**Recipient (no login)** — `/track/<token>`
- Live courier position and ETA, courier & vehicle details, delivery code, timeline, rate the courier

**Admin**
- KPIs: revenue (total/today), GMV, shipments, active, accept time, couriers online
- Live map of online couriers and unassigned shipments, 14-day chart
- Courier verification (approve/reject with documents), block/unblock users
- All shipments: search, filter, details, force re-dispatch, cancel, open tracking
- Finance: per-courier fees, earnings, COD held, record COD settlements and payouts, CSV export
- Settings: **platform fee per shipment**, pricing, size/vehicle multipliers, **X couriers per round**, radius start/step/max, offer timeout

## How dispatch works

1. Business inserts a shipment → DB trigger computes distance (haversine × 1.3 road factor), price, platform fee, courier earning, tracking token and OTP.
2. `dispatch_shipment()` picks the `dispatch_count` nearest couriers who are online, verified, not blocked, seen in the last 3 min, free, with a vehicle big enough, inside the current radius → creates offers + notifications (Supabase Realtime pushes them).
3. If nobody accepts within `offer_timeout_sec`, `expand_dispatch()` grows the radius by `radius_step_km` (up to `max_radius_km`) and notifies the next nearest couriers. This is triggered by the business screen and, optionally, by `pg_cron` (`dispatch_tick()`), which also expires shipments after 60 min.
4. `accept_offer()` does a conditional update (`where status = 'searching'`), so only the first courier wins.
5. On delivery (`advance_shipment` with the correct OTP) the ledger records `platform_fee`, `courier_earning` and `cod_collected`.

## Tech

Next.js 14 (App Router, TypeScript) · Tailwind · Supabase (Postgres, Auth, Realtime, Storage, RLS) · Leaflet + OpenStreetMap/CARTO tiles · Nominatim geocoding. No paid map keys required.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). Every table, function and the storage bucket is prefixed with `wasel_`, so it can safely share a Supabase project with your other apps.
3. (Recommended) **Database → Extensions → pg_cron**, then run:
   ```sql
   select cron.schedule('wasel-dispatch-tick', '* * * * *', $$select dispatch_tick()$$);
   ```
4. For quick testing, disable "Confirm email" in **Authentication → Providers → Email**.
5. Locally:
   ```bash
   cp .env.example .env.local   # fill in URL + anon key
   npm install
   npm run dev
   ```
6. Sign up, then make yourself admin:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```
7. Approve couriers from **Admin → Couriers** (unapproved couriers can't go online).

**Test the full loop:** open three browsers — business, courier (allow location), and the tracking link.

### Deploy to Vercel
Import the repo, add the three env vars from `.env.example` (set `NEXT_PUBLIC_SITE_URL` to your domain), deploy.

## Security
- Row Level Security on every table; businesses see only their shipments, couriers only offered/assigned ones.
- All state changes go through `security definer` functions with ownership & transition checks.
- Users can't self-promote to admin or change their own verification/ratings (guard triggers).
- Recipients only get a limited JSON view via the unguessable tracking token; the OTP is shown only once the parcel is picked up.

## Roadmap ideas
Online payments (card / wallet top-up), multi-drop routes, courier heat-map & surge pricing, push notifications (FCM), business API & webhooks for e-commerce stores, native wrapper (Capacitor).
