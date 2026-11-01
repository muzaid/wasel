# API specification

Wasel uses Supabase's generated API. Base URL: `https://<project>.supabase.co`. Every request sends the anon key and, when signed in,
the user's JWT. **Row Level Security decides what each user can read or change.** The app calls short names; `src/lib/supabase.ts` adds `wasel_`.

## Auth (Supabase Auth)
`POST /auth/v1/signup` (metadata: app=wasel, role=customer|business|courier, full_name, phone, business_name, vehicle…) ·
`POST /auth/v1/token?grant_type=password` · `POST /auth/v1/token?grant_type=refresh_token` · `POST /auth/v1/logout` · `POST /auth/v1/recover`

## RPC — `POST /rest/v1/rpc/<name>`
| Function | Who | Purpose |
|---|---|---|
| `wasel_add_role(p_role)` | user | add `customer` or `courier` to own account |
| `wasel_create_business(p_name, p_category, p_phone)` | user | create a business, become owner |
| `wasel_add_member(p_business, p_email, p_role)` | owner / manager | add employee (manager only by owner) |
| `wasel_remove_member(p_business, p_user)` | owner / manager, self | remove employee |
| `wasel_business_team(p_business)` | member | team list with emails |
| `wasel_search_businesses(p_q)` | user | B2B directory (public fields) |
| `wasel_dispatch_shipment(p_id)` | sender / dispatcher+ | notify nearest eligible couriers |
| `wasel_expand_dispatch(p_id)` | sender / dispatcher+ / cron | widen radius and re-dispatch |
| `wasel_accept_offer(p_id)` | offered courier | atomic first-accept-wins |
| `wasel_decline_offer(p_id)` | offered courier | decline |
| `wasel_advance_shipment(p_id, p_status, p_lat, p_lng, p_otp, p_photo)` | assigned courier | arrived → picked_up → in_transit → delivered (OTP) |
| `wasel_cancel_shipment(p_id, p_reason)` | sender / dispatcher+ / courier (before pickup) / admin | cancel or hand back |
| `wasel_update_location(p_lat, p_lng, p_heading)` | courier | live location + breadcrumb |
| `wasel_rate_shipment(p_id, p_stars, p_comment)` | sender side | rate courier |
| `wasel_get_tracking(p_token)` | anyone with link | limited tracking JSON |
| `wasel_rate_by_token(p_token, p_stars, p_comment)` | recipient | rate courier |
| `wasel_courier_balance(p_courier?)` | courier / admin | earnings summary |
| `wasel_admin_stats()` | admin | dashboard KPIs |
| `wasel_make_admin(p_email)` | SQL editor only | promote an admin |

## Tables — `GET/POST/PATCH /rest/v1/wasel_<table>`
shipments (insert = create delivery; price and type are recomputed by the server) · profiles · businesses · couriers ·
saved_addresses · notifications · ledger · settings (admin update) · user_roles (read own) · business_members (read).

## Realtime channels (postgres_changes, filtered by RLS)
shipments (by id, sender_id, business_id, recipient_business_id) · shipment_offers (by courier_id) · shipment_events · courier_locations · notifications · couriers (admin map)

The database remains the source of truth; screens reload from it on every event.
