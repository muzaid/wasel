"use client";
import AppShell from "@/components/AppShell";
import ShipmentDetail from "@/components/ShipmentDetail";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";

export default function BusinessShipment({ params }: { params: { id: string } }) {
  const ok = useRequireRole("business");
  return <AppShell wide>{ok ? <ShipmentDetail id={params.id} backHref="/business" /> : <Spinner />}</AppShell>;
}
