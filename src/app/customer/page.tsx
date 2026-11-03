"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Package, PackagePlus, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import ShipmentRow from "@/components/ShipmentRow";
import Map, { MapMarker } from "@/components/Map";
import { Avatar, Empty, Spinner, vehicleEmoji } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { supabase } from "@/lib/supabase";
import { isFinished } from "@/lib/delivery";
import { DEFAULT_CENTER, etaMin, money } from "@/lib/geo";
import type { NearbyCourier, Shipment } from "@/lib/types";

/** Personal (C2C) home: send a package, follow active deliveries, see recent ones. */
export default function CustomerHome() {
  const ok = useRequireRole("customer");
  const { session, profile } = useAuth();
  const { t } = useI18n();
  const { tm } = useTm();
  const [list, setList] = useState<Shipment[] | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [near, setNear] = useState<NearbyCourier[]>([]);
  const uid = session?.user.id;

  // where am I (falls back to Tel Aviv) and which couriers are around
  useEffect(() => {
    if (!navigator.geolocation) { setHere(DEFAULT_CENTER); return; }
    navigator.geolocation.getCurrentPosition((p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setHere(DEFAULT_CENTER), { maximumAge: 300000, timeout: 8000 });
  }, []);
  useEffect(() => {
    if (!here) return;
    const load = () => supabase.rpc("nearby_couriers", { p_lat: here.lat, p_lng: here.lng, p_vehicle: "bike", p_limit: 10 })
      .then(({ data }) => setNear((data as NearbyCourier[]) ?? []));
    load();
    const i = setInterval(() => { if (!document.hidden) load(); }, 20000);
    return () => clearInterval(i);
  }, [here]);

  useEffect(() => {
    if (!uid) return;
    const load = () => supabase.from("shipments").select("*").eq("sender_id", uid).is("business_id", null)
      .order("created_at", { ascending: false }).limit(100).then(({ data }) => setList((data as Shipment[]) ?? []));
    load();
    const ch = supabase.channel("cust-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments", filter: `sender_id=eq.${uid}` }, load).subscribe();
    const poll = setInterval(() => { if (!document.hidden) load(); }, 10000); // fallback if Realtime drops
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
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

      <div className="card mb-6 overflow-hidden">
        <div className="relative">
          <Map className="h-64 w-full" fitKey={String(!!here)} markers={[
            ...(here ? [{ id: "me", kind: "pickup" as const, lat: here.lat, lng: here.lng, label: "●" }] : []),
            ...near.map((c): MapMarker => ({ id: c.id, kind: "courier", lat: c.lat, lng: c.lng, emoji: vehicleEmoji(c.vehicle), popup: `${c.full_name} · ★ ${Number(c.rating).toFixed(1)}` })),
          ]} />
          <div className="absolute start-3 top-3 z-[500] rounded-xl bg-white/95 px-3 py-1.5 text-xs font-bold shadow">{tm("home_map_title")}</div>
        </div>
        <div className="grid grid-cols-2 divide-x border-t rtl:divide-x-reverse">
          <div className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-brand-600" />
            <div><div className="text-xs text-slate-500">{tm("couriers_near_you")}</div><div className="text-lg font-extrabold">{near.length}</div></div></div>
          <div className="flex items-center gap-3 p-4"><Clock className="h-5 w-5 text-brand-600" />
            <div><div className="text-xs text-slate-500">{tm("nearest_courier")}</div>
              <div className="text-lg font-extrabold">{near[0] ? `~${etaMin(Number(near[0].distance_km) * 1.3, near[0].vehicle)} ${tm("min_away")}` : "—"}</div></div></div>
        </div>
      </div>

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
