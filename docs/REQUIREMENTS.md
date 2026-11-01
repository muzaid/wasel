# Requirements — mapped from the Master PRD to Wasel's stack

Legend: ✅ done · 🟡 partial · ⏳ planned (phase) · ↔ adapted to our stack

## Ecosystem & identity
- ✅ Unified identity, one user → many roles (customer, courier, business member, admin) — `wasel_user_roles`
- ✅ Businesses as entities with multiple employees and permissions (owner / manager / dispatcher) — `wasel_business_members`
- ✅ Role switching in one app (header account switcher)
- 🟡 Registration by email ✅ · phone OTP ⏳ P2 (Supabase phone auth + SMS provider) · email verification ✅ (Supabase setting)
- ✅ Login, logout, password hashing, refresh-token rotation, sessions ↔ Supabase Auth · forgot/reset password ⏳ P2 UI
- ⏳ P2 Device management, account deactivation

## Customer (C2C)
- ✅ Dashboard: send a package, active / recent deliveries, spend
- ✅ Create delivery: pickup, destination, sender & recipient info, description, size, weight, vehicle, now / scheduled, price preview
- ⏳ P3 Package category, dimensions, package photos, prohibited categories
- ✅ Tracking: courier location, status, ETA, courier profile, vehicle, call
- ⏳ P5 Protected in-app chat (masked contact)
- ✅ History with search & CSV · ✅ rating · ✅ guest tracking link with limited data

## Business (B2C & B2B)
- ✅ Business profile: name, category, registration number, email, phone, address, logo, verification status
- ✅ Multiple employees + permissions · ✅ multiple businesses per user
- ✅ Dashboard: active, completed, spend, avg delivery time, **incoming B2B deliveries**
- ✅ B2B: pick the receiving business from Wasel's directory; it sees the incoming delivery and is notified
- ✅ Saved pickup addresses · ✅ history + CSV
- ⏳ P2 Business documents & admin approval UI · ⏳ P4 live map of nearby couriers, offer review / select / reject
- ⏳ P7 invoices, payment methods, monthly reports, contract pricing, recurring deliveries, delivery budget

## Courier
- ✅ Profile, photo, ID & licence upload, verification, online/offline, live GPS + heartbeat, offers with countdown & sound
- ✅ Accept, decline, arrive, pick up, deliver with OTP + proof photo, Google Maps / Waze, call sender / recipient, earnings & ledger
- ✅ Offer shows sender type (individual / business) and relationship (B2C / C2C / B2B)
- ⏳ P2 Multiple vehicles (year, capacity, photos, approval), more vehicle types (scooter, pickup, truck)
- ⏳ P4 Counter-offers · ⏳ P6 pickup proof photo, signature

## Matching engine
- ✅ Nearest-X eligible couriers, widening radius, first-accept-wins with atomic conditional update (no double assignment — tested)
- ✅ Eligibility: active, approved, online, recent location, vehicle size, not busy, within radius, not the sender
- ⏳ P4 Configurable scoring (distance, ETA, rating, reliability, price), modes A auto / B FCFS ✅ / C competitive offers, PostGIS

## Delivery lifecycle
- 🟡 State machine enforced on the server, every transition logged in `wasel_shipment_events`
- ⏳ P3 Extra states (DRAFT, OFFERS_RECEIVED, ARRIVED_AT_DESTINATION, FAILED, DISPUTED)

## Pricing, payments, wallets
- ✅ Server-side price (base + km × size × vehicle + fragile + COD, minimum), snapshot stored on the delivery, platform fee per delivery
- ⏳ P7 Zones, urgency, weight/dimension pricing, insurance, payment provider adapter, wallets, refunds, invoices, idempotency

## Admin
- ✅ KPIs incl. users and B2C / C2C / B2B mix, live map, courier verification, users (multi-role), shipments, finance, pricing & dispatch settings
- ⏳ P8 Business approval, disputes, audit log, reports, service areas, categories, cancellation policies, templates

## Cross-cutting
- ✅ RLS on every table, server-side validation, AR/EN/HE + RTL, PWA
- ✅ Tests: 15 unit (Vitest) + 34 database checks covering scenarios A–E
- ⏳ P5 push notifications (Web Push / FCM) and preferences · ⏳ P9 E2E (Playwright), monitoring, backups

## Documented assumptions
1. Everyone who signs up is also a customer (can send personally).
2. C2C senders cannot pick a receiving business (that would be C2B, not in scope); B2B is business → business only.
3. Employees must sign up first; owners/managers add them by email.
4. Business verification is recorded now; enforcement on posting will be an admin setting (P2).
