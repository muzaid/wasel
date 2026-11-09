"use client";
import AppShell from "@/components/AppShell";
import CouponManager from "@/components/CouponManager";
import { Spinner } from "@/components/ui";
import { PageHead } from "@/components/support";
import { useRequireRole } from "@/lib/auth";
import { useTs } from "@/lib/i18n-support";

/** Wasel coupons (paid by Wasel) + every business's discount codes. */
export default function AdminCoupons() {
  const ok = useRequireRole("admin");
  const { ts } = useTs();
  if (!ok) return <AppShell wide><Spinner /></AppShell>;
  return (
    <AppShell wide>
      <div className="mx-auto max-w-2xl">
        <PageHead title={ts("wasel_coupons")} sub={ts("wasel_pays_note")} />
        <CouponManager businessId={null} showBusinessCodes />
      </div>
    </AppShell>
  );
}
