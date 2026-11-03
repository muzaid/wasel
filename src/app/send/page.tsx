"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DeliveryForm from "@/components/DeliveryForm";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTm } from "@/lib/i18n-marketplace";

/** Public "send a package" page: anyone can set the route, see nearby couriers and prices; sending asks them to sign up. */
export default function SendPage() {
  const { session, roles, loading } = useAuth();
  const { tm } = useTm();
  const router = useRouter();
  useEffect(() => { if (!loading && session && roles.includes("customer")) router.replace("/customer/new"); }, [loading, session, roles, router]);
  if (loading || session) return <AppShell wide><Spinner /></AppShell>;
  return (
    <AppShell wide>
      <h1 className="mb-1 text-2xl font-extrabold">{tm("send_package")}</h1>
      <p className="mb-5 text-sm text-slate-500">{tm("send_package_hint")}</p>
      <DeliveryForm mode="customer" />
    </AppShell>
  );
}
