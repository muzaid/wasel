"use client";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { useAuth, homeFor } from "@/lib/auth";
import { useTm } from "@/lib/i18n-marketplace";
import type { Role } from "@/lib/types";

/** One account, many hats: lets a user jump between their personal, courier, business and admin apps. */
export default function RoleSwitcher() {
  const { roles, activeRole, memberships, membership, setActiveRole, setActiveBusiness } = useAuth();
  const { tm } = useTm();
  const router = useRouter();

  const options: { value: string; label: string; role: Role; businessId?: string }[] = [];
  if (roles.includes("customer")) options.push({ value: "customer", label: tm("role_customer"), role: "customer" });
  if (roles.includes("courier")) options.push({ value: "courier", label: tm("role_courier"), role: "courier" });
  memberships.forEach((m) => options.push({ value: `business:${m.business_id}`, label: `${tm("role_business")} · ${m.business.business_name || "—"}`, role: "business", businessId: m.business_id }));
  if (roles.includes("admin")) options.push({ value: "admin", label: tm("role_admin"), role: "admin" });
  if (options.length < 2) return null;

  const current = activeRole === "business" && membership ? `business:${membership.business_id}` : activeRole ?? "";
  return (
    <label className="relative hidden items-center sm:flex" title={tm("switch_account")}>
      <ArrowLeftRight className="pointer-events-none absolute start-2.5 h-4 w-4 text-slate-500" />
      <select value={current} aria-label={tm("switch_account")}
        onChange={(e) => {
          const o = options.find((x) => x.value === e.target.value)!;
          if (o.businessId) setActiveBusiness(o.businessId);
          setActiveRole(o.role);
          router.push(homeFor(o.role));
        }}
        className="max-w-[12rem] cursor-pointer appearance-none truncate rounded-full border border-slate-200 bg-white py-1.5 pe-3 ps-8 text-xs font-bold text-slate-700 hover:bg-slate-50">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
