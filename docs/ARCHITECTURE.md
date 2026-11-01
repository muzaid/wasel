# Architecture

## Decision: keep the current stack
The PRD recommends NestJS + Flutter + Redis + BullMQ. Wasel is already running on **Next.js + Supabase**, which covers the same
responsibilities with far less infrastructure for an MVP in one market. Mapping:

| PRD component | Wasel implementation |
|---|---|
| NestJS modules / services | PostgreSQL `security definer` functions (one per business operation) + RLS policies |
| REST `/api/v1` | Supabase PostgREST (tables) + RPC (`/rest/v1/rpc/wasel_*`) — see API_SPECIFICATION.md |
| JWT + refresh rotation | Supabase Auth |
| WebSockets / Socket.IO | Supabase Realtime (postgres_changes, RLS-filtered) |
| Redis online couriers | `wasel_couriers` (lat, lng, last_seen_at, is_online) — Redis only if load requires |
| BullMQ jobs | `pg_cron` (`wasel_dispatch_tick`) + Edge Functions for external calls |
| S3 storage | Supabase Storage (`wasel-uploads`) |
| PostGIS | Haversine in SQL today → PostGIS `geography` in P4 (Supabase supports the extension) |
| Flutter apps | Installable PWA now; native wrapper (Capacitor) or Flutter later on the same backend |
| Payments | Edge Function adapters per provider (P7) |

## Modular monolith inside the database
Each module is a group of tables + functions with the `wasel_` prefix:

- **Identity & roles** — `wasel_profiles`, `wasel_user_roles`, `wasel_has_role`, `wasel_add_role`, `wasel_make_admin`
- **Businesses** — `wasel_businesses`, `wasel_business_members`, `wasel_create_business`, `wasel_add_member`, `wasel_business_team`, `wasel_search_businesses`
- **Couriers** — `wasel_couriers`, `wasel_update_location`, verification guard
- **Deliveries** — `wasel_shipments`, `wasel_shipment_events`, `wasel_shipment_before_insert` (type + price), `wasel_advance_shipment`, `wasel_cancel_shipment`
- **Matching** — `wasel_shipment_offers`, `wasel_dispatch_shipment`, `wasel_expand_dispatch`, `wasel_dispatch_tick`, `wasel_accept_offer`
- **Tracking** — `wasel_courier_locations`, `wasel_get_tracking` (public, token-based)
- **Pricing** — `wasel_settings`, `wasel_quote_price` (client mirror in `src/lib/geo.ts` is preview only)
- **Finance** — `wasel_ledger`, `wasel_courier_balance`
- **Notifications** — `wasel_notifications`, `wasel_notify`
- **Reviews** — `wasel_ratings`, `wasel_rate_shipment`, `wasel_rate_by_token`
- **Admin** — `wasel_admin_stats`, admin-only policies

Business logic lives in these functions, not in React. The frontend only renders and calls them.

## Authorization model
- `auth.uid()` identifies the user; roles from `wasel_user_roles`; business rights from `wasel_business_members` with rank owner > manager > dispatcher.
- Shipment visibility: sender, members of the sending business, members of the receiving business (B2B), assigned / offered courier, admin.
- Shipment management (dispatch, cancel, rate): sender, dispatcher+ of the sending business, admin.

## Frontend structure
- `src/lib/auth.tsx` — session, roles, active role, memberships, active business; `useRequireRole(role)` guards each app.
- `src/lib/supabase.ts` — client with a proxy that adds the `wasel_` prefix to tables, RPCs and realtime subscriptions.
- Shared components keep one implementation per flow: `DeliveryForm` (B2C/B2B/C2C), `ShipmentDetail`, `HistoryList`.
