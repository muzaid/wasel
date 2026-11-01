# Wasel (واصل) — Project Overview

Multi-sided on-demand delivery marketplace for Palestine (₪, Arabic-first, English & Hebrew).
Anyone — a person or a business — requests a delivery; the nearest suitable courier takes it; everyone tracks it live.

## Delivery relationships (one shared engine)
| Type | Sender | Receiver | Example |
|---|---|---|---|
| **B2C** | Business | Person | Restaurant → customer, pharmacy order |
| **C2C** | Person | Person | Documents, gifts, belongings to a friend |
| **B2B** | Business | Business on Wasel | Warehouse → branch, supplier → shop |

The type is **derived on the server** from who sends and who receives (`wasel_shipment_before_insert`), never trusted from the client.

## Interfaces (one Next.js PWA, role-based)
- **Customer app** `/customer` — send packages, follow them, history, profile, add roles.
- **Business app** `/business` — dispatch deliveries (B2C/B2B), incoming B2B deliveries, team, history, profile.
- **Courier app** `/courier` — go online, receive offers, execute jobs, earnings, documents.
- **Admin dashboard** `/admin` — KPIs, live map, couriers, users, shipments, finance, settings.
- **Public tracking** `/track/<token>` — recipients, no login.

## Identity
One account, many roles: `customer`, `courier`, `business` (via business membership: owner / manager / dispatcher), `admin`.
Users switch between their apps with the account switcher in the header.

## Stack (kept by decision — see ARCHITECTURE.md)
Next.js 14 + TypeScript + Tailwind (PWA) · Supabase (PostgreSQL, Auth, Realtime, Storage, RLS, SQL functions) · Leaflet + OpenStreetMap · Vercel.

## Repository
```
src/app/            pages per app: customer/, business/, courier/, admin/, track/, login, signup
src/components/     shared UI: DeliveryForm, ShipmentDetail, HistoryList, Map, AppShell, RoleSwitcher, ...
src/lib/            supabase client (wasel_ prefix layer), auth (roles), i18n, delivery rules, geo/pricing
supabase/schema.sql base schema · supabase/migrations/*.sql ordered migrations · supabase/tests/ DB test suite
scripts/test-db.sh  runs the DB suite on a local PostgreSQL
docs/               this documentation · DEVELOPMENT_STATUS.md progress log
```
