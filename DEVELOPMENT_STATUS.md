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

## Next: Phase 2 — Profiles & verification
Phone OTP, password reset screen, business documents + admin approval, courier vehicles table (multiple vehicles, capacity, photos, approval), configurable verification rules.
