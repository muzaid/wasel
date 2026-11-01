"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import Map, { MapMarker } from "@/components/Map";
import ShipmentRow from "@/components/ShipmentRow";
import { Spinner, vehicleEmoji } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/geo";
import { ACTIVE, Courier, Shipment } from "@/lib/types";

interface Stats {
  shipments_total: number; shipments_today: number; active: number; delivered: number; cancelled: number; revenue_total: number; revenue_today: number;
  gmv: number; users?: number; b2c?: number; c2c?: number; b2b?: number; couriers_online: number; couriers_pending: number; businesses: number; couriers: number; avg_accept_sec: number;
  daily: { day: string; shipments: number; revenue: number }[];
}

export default function AdminHome() {
  const ok = useRequireRole("admin");
  const { t } = useI18n();
  const { tm } = useTm();
  const [s, setS] = useState<Stats | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [active, setActive] = useState<Shipment[]>([]);

  useEffect(() => {
    if (!ok) return;
    const load = () => {
      supabase.rpc("admin_stats").then(({ data }) => setS(data as Stats));
      supabase.from("couriers").select("*").eq("is_online", true).gte("last_seen_at", new Date(Date.now() - 180000).toISOString()).then(({ data }) => setCouriers((data as Courier[]) ?? []));
      supabase.from("shipments").select("*").in("status", ["searching", ...ACTIVE]).order("created_at", { ascending: false }).limit(50).then(({ data }) => setActive((data as Shipment[]) ?? []));
    };
    load();
    const ch = supabase.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "couriers" }, (p) => {
        const c = p.new as Courier;
        setCouriers((xs) => c.is_online ? [...xs.filter((x) => x.id !== c.id), c] : xs.filter((x) => x.id !== c.id));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ok]);

  const markers = useMemo<MapMarker[]>(() => [
    ...couriers.filter((c) => c.lat && c.lng).map((c) => ({ id: c.id, kind: "courier" as const, lat: c.lat!, lng: c.lng!, emoji: vehicleEmoji(c.vehicle) })),
    ...active.filter((a) => a.status === "searching").map((a) => ({ id: a.id, kind: "pickup" as const, lat: a.pickup_lat, lng: a.pickup_lng, label: "?", popup: a.pickup_address })),
  ], [couriers, active]);

  if (!ok || !s) return <AppShell wide><Spinner /></AppShell>;
  const max = Math.max(1, ...s.daily.map((d) => d.shipments));
  const cards: [TKey, string, string?][] = [
    ["revenue", money(s.revenue_total), "text-brand-600"], ["revenue_today", money(s.revenue_today)], ["gmv", money(s.gmv)],
    ["shipments", `${s.shipments_total}`], ["today", `${s.shipments_today}`], ["active", `${s.active}`, "text-sky-600"],
    ["delivered_count", `${s.delivered}`], ["st_cancelled", `${s.cancelled}`], ["online_now", `${s.couriers_online} / ${s.couriers}`, "text-brand-600"],
    ["accept_time", `${s.avg_accept_sec}s`], ["business", `${s.businesses}`], ["pending", `${s.couriers_pending}`, s.couriers_pending ? "text-amber-600" : ""],
  ];

  return (
    <AppShell wide>
      <h1 className="mb-5 text-2xl font-extrabold">{t("dashboard")}</h1>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {cards.map(([k, v, c]) => (
          <div key={k} className="stat"><div className="stat-label">{t(k as TKey)}</div><div className={`stat-value text-xl ${c ?? ""}`}>{v}</div></div>
        ))}
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="stat"><div className="stat-label">{tm("users")}</div><div className="stat-value text-xl">{s.users ?? "—"}</div></div>
        {(["b2c", "c2c", "b2b"] as const).map((k) => (
          <div key={k} className="stat"><div className="stat-label">{tm(`type_${k}_long`)}</div><div className="stat-value text-xl">{s[k] ?? 0}</div></div>
        ))}
      </div>
      {s.couriers_pending > 0 && <Link href="/admin/couriers" className="mb-6 block rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">⚠️ {s.couriers_pending} {t("couriers")} — {t("pending")} → {t("verification")}</Link>}

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Map markers={markers} fitKey={String(markers.length > 0)} className="h-[420px] w-full rounded-2xl" />
        <div className="card p-5">
          <div className="mb-4 font-bold">{t("shipments")} · 14d</div>
          <div className="flex h-64 items-end gap-1.5" dir="ltr">
            {s.daily.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
                <div className="text-[10px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100">{d.shipments}</div>
                <div className="w-full rounded-t-md bg-brand-500" style={{ height: `${(d.shipments / max) * 200}px` }} title={`${d.day}: ${d.shipments} · ${money(d.revenue)}`} />
                <div className="text-[9px] text-slate-400">{d.day.slice(3)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="mb-3 font-bold">{t("active")} ({active.length})</h2>
      <div className="grid gap-3 md:grid-cols-2">{active.map((a) => <ShipmentRow key={a.id} s={a} href={`/admin/shipments?q=${a.code}`} />)}</div>
    </AppShell>
  );
}
