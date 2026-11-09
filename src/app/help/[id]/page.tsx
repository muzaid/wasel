"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TicketThread from "@/components/TicketThread";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function HelpTicket({ params }: { params: { id: string } }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !session) router.replace("/login?next=/help/" + params.id); }, [loading, session, router, params.id]);
  return <AppShell>{session ? <TicketThread id={Number(params.id)} back="/help" /> : <Spinner />}</AppShell>;
}
