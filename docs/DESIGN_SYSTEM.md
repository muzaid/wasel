# Design system

Defined in `tailwind.config.ts`, `src/app/globals.css` and `src/components/ui.tsx`.

- **Colours**: brand green `brand-50…900` (primary, success), ink `ink-900` (dark surfaces/text), accent amber (pending, COD, highlights),
  red (errors, cancellation), slate neutrals. White cards on `#f6f8fb`.
- **Typography**: IBM Plex Sans Arabic + Rubik; bold headings, tabular numbers for money and counts.
- **Shape**: `rounded-2xl` cards, `rounded-xl` controls, full-round chips and avatars; soft shadows.
- **Components**: `.btn-primary / .btn-dark / .btn-ghost / .btn-danger`, `.input`, `.label`, `.card`, `.chip`, `.stat`;
  `StatusBadge`, `Progress`, `Timeline`, `CourierCard`, `ShareTracking`, `Avatar`, `Stars`, `Empty`, `Spinner`, `Map`, `PhotoUpload`, `RoleSwitcher`.
- **Status colours**: searching amber · accepted sky · arrived indigo · picked up violet · in transit green · delivered solid green · cancelled grey · expired red.
- **Navigation**: top bar (logo, role chip, account switcher, language, notifications, avatar, logout) + bottom tab bar on mobile.
  Customer: Home · Send · History · Profile. Business: Dashboard · New · History · Team · Profile. Courier: Map · Earnings · Profile. Admin: 6 sections.
- **RTL**: Arabic/Hebrew render right-to-left using logical properties (`ms-`, `me-`, `start-`, `end-`); numbers and phones forced `ltr`.
- **States**: every list has loading (Spinner), empty (Empty with action) and error messages; destructive actions ask for confirmation.
