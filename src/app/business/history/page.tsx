"use client";
import AppShell from "@/components/AppShell";
import HistoryList from "@/components/HistoryList";
import { Spinner } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";

export default function History() {
  const ok = useRequireRole("business");
  const { business } = useAuth();
  const value = business?.id;
  return <AppShell>{ok && value ? <HistoryList column="business_id" value={value} hrefBase="/business/shipments" /> : <Spinner />}</AppShell>;
}
