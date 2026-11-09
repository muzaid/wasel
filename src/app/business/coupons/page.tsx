"use client";
import AppShell from "@/components/AppShell";
import CouponManager from "@/components/CouponManager";
import { Spinner } from "@/components/ui";
import { PageHead } from "@/components/support";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useTs } from "@/lib/i18n-support";

/** Business discount codes (owner / manager). */
export default function BusinessCoupons() {
  const ok = useRequireRole("business");
  const { business } = useAuth();
  const { ts } = useTs();
  if (!ok || !business) return <AppShell><Spinner /></AppShell>;
  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <PageHead title={ts("discount_codes")} sub={ts("discount_codes_hint")} back="/account" />
        <CouponManager businessId={business.id} />
      </div>
    </AppShell>
  );
}
