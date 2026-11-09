"use client";
import AppShell from "@/components/AppShell";
import TicketThread from "@/components/TicketThread";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";

export default function AdminTicket({ params }: { params: { id: string } }) {
  const ok = useRequireRole("admin");
  return <AppShell wide>{ok ? <TicketThread id={Number(params.id)} staff back="/admin/tickets" /> : <Spinner />}</AppShell>;
}
