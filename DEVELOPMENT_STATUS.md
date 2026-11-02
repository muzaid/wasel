# Development status

_Last update: Phase 1 complete._

## Phase 1 — Foundation & identity ✅
Implemented
- Multi-role identity (`wasel_user_roles`), account switcher, role guard that switches into the right app
- Customer app (C2C): dashboard, send package, delivery detail, history, profile, "become a courier", "create a business"
- Businesses as entities with employees (owner / manager / dispatcher), team page, multiple businesses per user
- B2C / C2C / B2B derived on the server; B2B directory search, receiving business sees + is notified of incoming deliveries
- Shared components: DeliveryForm, ShipmentDetail, HistoryList; delivery type badges everywhere; admin user roles + delivery-mix KPIs
- Docs in `docs/`

Tests executed
- `npm test` — 15 unit tests (pricing, delivery type, state machine, distance/ETA): **15/15 pass**
- `npm run test:db` — 34 database checks incl. PRD scenarios A (B2C), B (C2C + OTP), C (B2B), D (competing couriers), E (cancellation), roles & permissions: **34/34 pass**
- Upgrade test: migration 003 on a database with existing data and another app's tables: **pass**, re-run safe
- `next build`: **pass**

To deploy this phase
1. Supabase SQL Editor → run `supabase/migrations/003_marketplace_foundation.sql`
2. Redeploy on Vercel

## Test data & location
- `supabase/seed/seed_test_data.sql`: 15 test accounts (password `Wasel123!`) and 22 deliveries in Israeli cities; re-runnable
- Maps default to Tel Aviv and centre on the user's GPS when allowed; address search limited to Israel

## Courier dispatch reliability (migration 004)
- Couriers send a heartbeat every 20 s with or without GPS, so they are not dropped as "stale"
- A courier coming online picks up deliveries already waiting nearby; search radius widens on courier heartbeats (pg_cron optional)
- Courier screen checklist: approved · online · location · connected · deliveries waiting nearby
- Tests: 10 new DB checks (`supabase/tests/20_courier_dispatch.sql`) — DB suite **44/44 pass**
- Known limit: no push to a closed app/phone yet (Phase 5: Web Push)

## Next: Phase 2 — Profiles & verification
Phone OTP, password reset screen, business documents + admin approval, courier vehicles table (multiple vehicles, capacity, photos, approval), configurable verification rules.
