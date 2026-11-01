"use client";
import AppShell from "@/components/AppShell";
import ShipmentDetail from "@/components/ShipmentDetail";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";

export default function CustomerShipment({ params }: { params: { id: string } }) {
  const ok = useRequireRole("customer");
  return <AppShell wide>{ok ? <ShipmentDetail id={params.id} backHref="/customer" /> : <Spinner />}</AppShell>;
}
