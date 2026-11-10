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

## Choose your courier + phone sign-up (migration 006)
- Public send page `/send`: anyone sets pickup / drop-off on the map, sees the 10 nearest available couriers
  (photo, rating, reviews, deliveries, vehicle, distance, ETA, price) and picks one or sends to all; visitors are asked to
  sign up and their delivery details are restored afterwards
- Direct request to one courier (price follows that courier's vehicle); if they decline or do not answer, the sender
  chooses another courier or sends to all; the sender is notified of a decline
- Sign-up / login by phone with an SMS code, or by email
- Customer home: map of couriers around you, couriers nearby, nearest ETA
- Tests: 16 new DB checks (`supabase/tests/30_choose_courier.sql`) — DB suite **60/60 pass**; build passes

## Account menus, refunds, coupons, help desk (migration 007)
- **My account** (`/account`) with a menu per role:
  - customer: Wasel credit, coupons, send, deliveries, refunds, help desk
  - business: monthly stats, new delivery, history, team, discount codes, refunds, incoming B2B
  - courier: weekly earnings, request payout, jobs map, documents & vehicle, report a problem
  - admin: refunds, help-desk tickets, coupons, shipments, finance, settings
- **Refunds**: the sender asks from the delivery page (reason, full or part amount, photo, card or Wasel credit);
  admins approve or reject in `/admin/refunds`; approved refunds go to the ledger, credit refunds straight to the wallet
- **Wasel credit**: wallet per user, filled by credit refunds, used at checkout, returned if a delivery is cancelled
- **Coupons**: Wasel coupons (admin, paid by Wasel) and business discount codes (owner/manager, paid by the business,
  valid on deliveries sent to that business); % or ₪, max discount, min price, total and per-person limits, end date.
  The discount follows re-pricing and comes back if the delivery is cancelled; couriers always get their full earning
- **Help desk** (`/help`): FAQ with search, your requests and refunds, write to us, chat thread with support;
  admins answer in `/admin/tickets`. **Contact us** (`/contact`, guests too) and **About us** (`/about`)
- Not built yet (shown in the design): invite-a-friend bonus, saved payment cards, bulk upload, invoices, courier bonuses,
  automatic card refunds (card refunds are recorded; the money is returned through your payment provider)
- Tests: 42 new DB checks (`supabase/tests/40_support_refunds_coupons.sql`) — DB suite **102/102 pass**; build passes

## Smart courier choice — two customers, one courier (migration 008)
- **Hold**: a courier asked directly is reserved for that customer while the request is open (offer timeout);
  he is hidden from other customers' lists and from "send to all" rounds, so he never gets two direct requests
- **First come, first served**: requests for the same courier are serialized with a row lock — if two customers tap him
  in the same second, only the first gets him
- **Customer's fallback** (chosen on the send form, kept through sign-up):
  next best courier automatically at the same price or less (default, up to 3 tries, then send to all) ·
  send to all nearby · let me choose (top 3 suggestions, same-price first, one-tap request)
- Fallback also runs when the courier declines, does not answer in time, accepts another delivery, or goes offline
- Ranking: distance + rating (1.5 km for every 0.1 star below 4.8; new couriers count as 4.6); the price never goes up without the customer
- The delivery page explains what happened ("Avi was just booked by another customer — we asked Dana instead")
- The courier list on the send form refreshes every 6 s while a courier is chosen and says if he was just booked
- Tests: 23 new DB checks (`supabase/tests/50_smart_courier_choice.sql`) — DB suite **126/126 pass**; build passes

## Next: Phase 2 — Profiles & verification
Phone OTP, password reset screen, business documents + admin approval, courier vehicles table (multiple vehicles, capacity, photos, approval), configurable verification rules.
