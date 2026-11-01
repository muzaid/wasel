"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PackagePlus, Package } from "lucide-react";
import AppShell from "@/components/AppShell";
import ShipmentRow from "@/components/ShipmentRow";
import { Avatar, Empty, Spinner } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { isFinished } from "@/lib/delivery";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/geo";
import type { Shipment } from "@/lib/types";

export default function BusinessHome() {
  const ok = useRequireRole("business");
  const { business } = useAuth();
  const { t } = useI18n();
  const { tm } = useTm();
  const [list, setList] = useState<Shipment[] | null>(null);
  const [incoming, setIncoming] = useState<Shipment[]>([]);
  const bid = business?.id;

  useEffect(() => {
    if (!bid) return;
    const load = () => supabase.from("shipments").select("*").eq("business_id", bid).order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setList((data as Shipment[]) ?? []));
    const loadIncoming = () => supabase.from("shipments").select("*").eq("recipient_business_id", bid).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setIncoming((data as Shipment[]) ?? []));
    load(); loadIncoming();
    const ch = supabase.channel("biz-" + bid)
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments", filter: `business_id=eq.${bid}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments", filter: `recipient_business_id=eq.${bid}` }, loadIncoming)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bid]);

  if (!ok || !list) return <AppShell><Spinner /></AppShell>;
  const active = list.filter((s) => !isFinished(s.status));
  const delivered = list.filter((s) => s.status === "delivered");
  const spent = delivered.reduce((a, s) => a + Number(s.price), 0);
  const cod = delivered.reduce((a, s) => a + Number(s.cod_amount), 0);
  const avg = delivered.length
    ? Math.round(delivered.reduce((a, s) => a + (new Date(s.delivered_at!).getTime() - new Date(s.created_at).getTime()), 0) / delivered.length / 60000) : 0;

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar src={business?.logo_url} name={business?.business_name} size={52} square />
          <div>
            <div className="text-sm text-slate-500">{t("dashboard")}</div>
            <h1 className="text-2xl font-extrabold">{business?.business_name || t("business")}</h1>
          </div>
        </div>
        <Link href="/business/new" className="btn-primary px-5 py-3"><PackagePlus className="h-5 w-5" />{t("new_shipment")}</Link>
      </div>

      {!business?.logo_url && (
        <Link href="/business/profile" className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800">
          <span>🏪 {t("add_logo_nudge")}</span><span className="underline">{t("upload")}</span>
        </Link>
      )}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="stat"><div className="stat-label">{t("active")}</div><div className="stat-value text-brand-600">{active.length}</div></div>
        <div className="stat"><div className="stat-label">{t("delivered_count")}</div><div className="stat-value">{delivered.length}</div></div>
        <div className="stat"><div className="stat-label">{t("total_spent")}</div><div className="stat-value">{money(spent)}</div></div>
        <div className="stat"><div className="stat-label">{t("avg_time")}</div><div className="stat-value">{avg} <span className="text-sm font-medium text-slate-400">{t("min")}</span></div></div>
      </div>
      {cod > 0 && <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">💵 COD {t("delivered_count")}: <b>{money(cod)}</b></div>}

      <h2 className="mb-3 font-bold">{t("active")}</h2>
      <div className="space-y-3">
        {active.length === 0 && (
          <Empty icon={<Package className="h-6 w-6" />} title={t("empty_shipments")}
            action={<Link href="/business/new" className="btn-primary">{t("create_first")}</Link>} />
        )}
        {active.map((s) => <ShipmentRow key={s.id} s={s} href={`/business/shipments/${s.id}`} />)}
      </div>

      {incoming.length > 0 && (
        <>
          <h2 className="mb-1 mt-8 font-bold">📥 {tm("incoming")}</h2>
          <p className="mb-3 text-xs text-slate-500">{tm("incoming_hint")}</p>
          <div className="space-y-3">{incoming.slice(0, 5).map((s) => <ShipmentRow key={s.id} s={s} href={`/track/${s.tracking_token}`} />)}</div>
        </>
      )}

      {list.length > active.length && (
        <>
          <div className="mb-3 mt-8 flex items-center justify-between">
            <h2 className="font-bold">{t("history")}</h2>
            <Link href="/business/history" className="text-sm font-semibold text-brand-700">{t("all")}</Link>
          </div>
          <div className="space-y-3">
            {list.filter((s) => !active.includes(s)).slice(0, 5).map((s) => <ShipmentRow key={s.id} s={s} href={`/business/shipments/${s.id}`} />)}
          </div>
        </>
      )}
    </AppShell>
  );
}
