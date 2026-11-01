"use client";
import AppShell from "@/components/AppShell";
import DeliveryForm from "@/components/DeliveryForm";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function NewBusinessShipment() {
  const ok = useRequireRole("business");
  const { t } = useI18n();
  return (
    <AppShell wide>
      <h1 className="mb-5 text-2xl font-extrabold">{t("new_shipment")}</h1>
      {ok ? <DeliveryForm mode="business" /> : <Spinner />}
    </AppShell>
  );
}
