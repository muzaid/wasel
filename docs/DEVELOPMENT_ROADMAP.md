# Development roadmap (PRD phases adapted to Next.js + Supabase)

| Phase | Scope | Status |
|---|---|---|
| **1 Foundation & identity** | multi-role accounts, customer app (C2C), businesses as entities + employees, B2C/C2C/B2B derivation, B2B directory + incoming, docs, unit + DB tests | ✅ done |
| 2 Profiles & verification | phone OTP, forgot password UI, business documents + admin approval, courier multiple vehicles (types incl. scooter/pickup/truck, capacity, photos, approval), configurable verification rules | next |
| 3 Delivery engine | package category, dimensions, photos, prohibited items, extra statuses (arrived at destination, failed, disputed), drafts, recipient business confirmation of receipt | |
| 4 Matching | PostGIS, configurable scoring, modes: automatic / first-come / **competitive offers + counter-offers**, sender picks offer, live map of nearby couriers | |
| 5 Real-time & comms | protected in-app chat, push notifications (Web Push/FCM) + preferences, better ETA | |
| 6 Execution | pickup proof photo, signature, GPS-stamped proof, configurable proof policy | |
| 7 Finance | pricing zones / urgency / weight / insurance, payment adapter (cards via provider tokenization, cash, wallet, business billing), refunds, cancellation fees, invoices, payouts | |
| 8 Administration | business approval, disputes, audit log, reports, service areas, categories, cancellation policy, notification templates | |
| 9 Quality & release | Playwright E2E for scenarios A–E, security review, load test, monitoring, backups, staging | |

## External services & credentials needed
- Supabase project (have) — enable **pg_cron**; optional **PostGIS** (P4); phone auth + SMS provider (P2)
- Payment provider for Israel (P7) — to be chosen by you
- Push: VAPID keys (Web Push) or Firebase project (P5)
- Optional paid map tiles for scale (`NEXT_PUBLIC_MAP_TILES_URL`)

## Risks
- Courier GPS while the PWA is in the background is limited by mobile browsers → native wrapper later.
- Single Supabase project shared with other apps → prefixed objects (done), but quotas are shared.
- Payment provider availability in the target market.
