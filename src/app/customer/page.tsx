"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Package, PackagePlus } from "lucide-react";
import AppShell from "@/components/AppShell";
import ShipmentRow from "@/components/ShipmentRow";
import { Avatar, Empty, Spinner } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { supabase } from "@/lib/supabase";
import { isFinished } from "@/lib/delivery";
import { money } from "@/lib/geo";
import type { Shipment } from "@/lib/types";

/** Personal (C2C) home: send a package, follow active deliveries, see recent ones. */
export default function CustomerHome() {
  const ok = useRequireRole("customer");
  const { session, profile } = useAuth();
  const { t } = useI18n();
  const { tm } = useTm();
  const [list, setList] = useState<Shipment[] | null>(null);
  const uid = session?.user.id;

  useEffect(() => {
    if (!uid) return;
    const load = () => supabase.from("shipments").select("*").eq("sender_id", uid).is("business_id", null)
      .order("created_at", { ascending: false }).limit(100).then(({ data }) => setList((data as Shipment[]) ?? []));
    load();
    const ch = supabase.channel("cust-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments", filter: `sender_id=eq.${uid}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid]);

  if (!ok || !list) return <AppShell><Spinner /></AppShell>;
  const active = list.filter((s) => !isFinished(s.status));
  const done = list.filter((s) => isFinished(s.status));
  const spent = list.filter((s) => s.status === "delivered").reduce((a, s) => a + Number(s.price), 0);

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Avatar src={profile?.avatar_url} name={profile?.full_name} size={48} />
        <div>
          <div className="text-sm text-slate-500">{t("dashboard")}</div>
          <h1 className="text-2xl font-extrabold">{profile?.full_name || tm("customer")}</h1>
        </div>
      </div>

      <Link href="/customer/new" className="group mb-6 flex items-center gap-5 overflow-hidden rounded-3xl bg-ink-900 p-6 text-white shadow-lg">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-500 text-3xl shadow-lg shadow-brand-500/30">📦</div>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-extrabold">{tm("send_package")}</div>
          <div className="text-sm text-slate-300">{tm("send_package_hint")}</div>
        </div>
        <ArrowLeft className="h-6 w-6 shrink-0 transition group-hover:-translate-x-1 ltr:rotate-180 ltr:group-hover:translate-x-1" />
      </Link>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <div className="stat"><div className="stat-label">{t("active")}</div><div className="stat-value text-brand-600">{active.length}</div></div>
        <div className="stat"><div className="stat-label">{t("delivered_count")}</div><div className="stat-value">{list.filter((s) => s.status === "delivered").length}</div></div>
        <div className="stat"><div className="stat-label">{t("total_spent")}</div><div className="stat-value">{money(spent)}</div></div>
      </div>

      <h2 className="mb-3 font-bold">{t("active")}</h2>
      <div className="space-y-3">
        {active.length === 0 && (
          <Empty icon={<Package className="h-6 w-6" />} title={tm("no_deliveries")}
            action={<Link href="/customer/new" className="btn-primary"><PackagePlus className="h-4 w-4" />{tm("send_package")}</Link>} />
        )}
        {active.map((s) => <ShipmentRow key={s.id} s={s} href={`/customer/shipments/${s.id}`} />)}
      </div>

      {done.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex items-center justify-between">
            <h2 className="font-bold">{tm("recent")}</h2>
            <Link href="/customer/history" className="text-sm font-semibold text-brand-700">{t("all")}</Link>
          </div>
          <div className="space-y-3">{done.slice(0, 5).map((s) => <ShipmentRow key={s.id} s={s} href={`/customer/shipments/${s.id}`} />)}</div>
        </>
      )}
    </AppShell>
  );
}
