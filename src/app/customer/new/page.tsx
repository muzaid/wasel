"use client";
import AppShell from "@/components/AppShell";
import DeliveryForm from "@/components/DeliveryForm";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";
import { useTm } from "@/lib/i18n-marketplace";

export default function NewPersonalShipment() {
  const ok = useRequireRole("customer");
  const { tm } = useTm();
  return (
    <AppShell wide>
      <h1 className="mb-1 text-2xl font-extrabold">{tm("send_package")}</h1>
      <p className="mb-5 text-sm text-slate-500">{tm("send_package_hint")}</p>
      {ok ? <DeliveryForm mode="customer" /> : <Spinner />}
    </AppShell>
  );
}
