# Security

- **Authentication**: Supabase Auth (bcrypt password hashing, JWT access tokens, rotating refresh tokens, rate-limited auth endpoints).
- **Authorization**: Row Level Security on every `wasel_` table; all state changes go through `security definer` functions that check
  ownership, membership rank and allowed status transitions. The client never decides price, delivery type or status.
- **Roles**: users cannot self-assign `admin` or `business`; business access only through `wasel_business_members`; guard triggers stop
  users changing their own verification, rating, blocked flag, business owner or business verification.
- **Concurrency**: assignment is a conditional `update … where status = 'searching'` inside the function → one courier per delivery (tested).
- **Privacy**: recipients see a token-scoped JSON only; delivery code shown only after pickup; courier location hidden after delivery;
  couriers see sender details only while they hold an offer or the job; team emails visible only to members.
- **Files**: uploads only into the user's own folder in `wasel-uploads`; images are resized in the browser.
- **Secrets**: only the public anon key ships to the browser; no service keys in the repo; `.env*` ignored.
- **Shared project safety**: Wasel only creates profiles for sign-ups marked `app=wasel`; all objects prefixed.

## Planned
Phone verification, audit log for admin actions, rate limits on RPCs, file type/size validation in storage policies,
payment tokenization (no card data stored), dependency scanning in CI, OWASP review before release.
