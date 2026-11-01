"use client";
import AppShell from "@/components/AppShell";
import HistoryList from "@/components/HistoryList";
import { Spinner } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";

export default function History() {
  const ok = useRequireRole("customer");
  const { session } = useAuth();
  const value = session?.user.id;
  return <AppShell>{ok && value ? <HistoryList column="sender_id" value={value} hrefBase="/customer/shipments" /> : <Spinner />}</AppShell>;
}
