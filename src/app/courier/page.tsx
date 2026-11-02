"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Banknote, MapPin, Navigation, Power } from "lucide-react";
import AppShell from "@/components/AppShell";
import Map, { MapMarker } from "@/components/Map";
import { Avatar, Spinner, StatusBadge, vehicleEmoji } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { supabase, T } from "@/lib/supabase";
import { beep, errKey, useSettings } from "@/lib/hooks";
import { haversineKm, money } from "@/lib/geo";
import { ACTIVE, Shipment } from "@/lib/types";
import { useCourier } from "@/components/CourierProvider";

type OfferRow = { id: number; distance_km: number; status: string; created_at: string; shipments: Shipment & { business?: { business_name: string; logo_url: string | null } | null; sender?: { full_name: string; avatar_url: string | null } | null } };

export default function CourierHome() {
  const ok = useRequireRole("courier");
  const { session, courier } = useAuth();
  const { t } = useI18n();
  const { tm } = useTm();
  const router = useRouter();
  const settings = useSettings();
  const { online, setOnline, pos, geoError, status } = useCourier();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [active, setActive] = useState<Shipment | null>(null);
  const [today, setToday] = useState({ earn: 0, count: 0 });
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = session?.user.id;

  const load = useCallback(async () => {
    if (!uid) return;
    const [{ data: o }, { data: a }, { data: l }] = await Promise.all([
      supabase.from("shipment_offers").select(`id,distance_km,status,created_at,shipments:${T("shipments")}(*, business:${T("businesses")}!business_id(business_name, logo_url), sender:${T("profiles")}!sender_id(full_name, avatar_url))`).eq("courier_id", uid).eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("shipments").select("*").eq("courier_id", uid).in("status", ACTIVE).maybeSingle(),
      supabase.from("ledger").select("amount").eq("courier_id", uid).eq("kind", "courier_earning").gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);
    setOffers(((o as unknown as OfferRow[]) ?? []).filter((x) => x.shipments?.status === "searching"));
    setActive(a as Shipment | null);
    setToday({ earn: (l ?? []).reduce((s, x) => s + Number(x.amount), 0), count: l?.length ?? 0 });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    load();
    const ch = supabase.channel("courier-" + uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shipment_offers", filter: `courier_id=eq.${uid}` }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shipment_offers", filter: `courier_id=eq.${uid}` }, load)
      .subscribe();
    // Fallback when Realtime is slow or disconnected: check for new requests every 4 s and when the tab is shown again
    const poll = setInterval(load, 4000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { supabase.removeChannel(ch); clearInterval(poll); document.removeEventListener("visibilitychange", vis); };
  }, [uid, load]);

  // The server's heartbeat just created offers for this courier: show them right away
  useEffect(() => { if (status?.new_offers) load(); }, [status, load]);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const timeout = (settings?.offer_timeout_sec ?? 30) * 1000;
  const live = offers.filter((o) => now - new Date(o.created_at).getTime() < timeout);
  const offer = live[0];

  // Popup alert for every new request, whichever way it arrived (Realtime or polling)
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = live.map((o) => `${o.id}:${o.created_at}`); // re-sent offers keep their id but get a new time
    if (seen.current === null) { seen.current = new Set(ids); if (!ids.length) return; }
    const fresh = ids.filter((i) => !seen.current!.has(i));
    ids.forEach((i) => seen.current!.add(i));
    if (!fresh.length) return;
    beep();
    try { if ("Notification" in window && Notification.permission === "granted" && document.hidden) new Notification(t("new_offer")); } catch { /* unsupported */ }
  }, [live, t]);

  const markers = useMemo<MapMarker[]>(() => [
    ...(pos ? [{ id: "me", kind: (online ? "courier" : "courier_idle") as MapMarker["kind"], ...pos, emoji: vehicleEmoji(courier?.vehicle) }] : []),
    ...(offer ? [
      { id: "p", kind: "pickup" as const, lat: offer.shipments.pickup_lat, lng: offer.shipments.pickup_lng },
      { id: "d", kind: "dropoff" as const, lat: offer.shipments.dropoff_lat, lng: offer.shipments.dropoff_lng },
    ] : []),
  ], [pos, online, offer, courier?.vehicle]);

  if (!ok || !courier) return <AppShell><Spinner /></AppShell>;

  const accept = async (o: OfferRow) => {
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("accept_offer", { p_id: o.shipments.id });
    setBusy(false);
    if (error) { setMsg(t(errKey(error.message) as TKey)); load(); return; }
    router.push(`/courier/job/${o.shipments.id}`);
  };
  const decline = async (o: OfferRow) => { await supabase.rpc("decline_offer", { p_id: o.shipments.id }); load(); };

  const verified = courier.verification === "approved";

  return (
    <AppShell>
      {!verified && (
        <div className={`mb-4 flex items-start gap-3 rounded-2xl p-4 text-sm ${courier.verification === "rejected" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1">{t(courier.verification === "rejected" ? "rejected_verification" : "pending_verification")}</div>
          <Link href="/courier/profile" className="font-bold underline">{t("profile")}</Link>
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="stat"><div className="stat-label">{t("today")}</div><div className="stat-value text-brand-600">{money(today.earn)}</div></div>
        <div className="stat"><div className="stat-label">{t("deliveries")}</div><div className="stat-value">{today.count}</div></div>
        <div className="stat"><div className="stat-label">{t("rating")}</div><div className="stat-value">★ {Number(courier.rating_avg).toFixed(1)}</div></div>
      </div>

      <div className="relative">
        <Map markers={markers} fitKey={`${!!pos}-${offer?.id}`} follow={offer ? undefined : "me"} className="h-[55vh] min-h-[320px] w-full rounded-3xl" />
        <div className="absolute inset-x-3 top-3 z-[500] flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
          <span className={`h-3 w-3 rounded-full ${online ? "animate-pulse bg-brand-500" : "bg-slate-300"}`} />
          <div className="flex-1 text-sm font-semibold">{online ? t("you_are_online") : t("you_are_offline")}</div>
          <button disabled={!verified} onClick={() => setOnline(!online)} className={online ? "btn-dark" : "btn-primary"}>
            <Power className="h-4 w-4" />{online ? t("go_offline") : t("go_online")}
          </button>
        </div>
        {geoError && online && <div className="absolute inset-x-3 top-20 z-[500] rounded-xl bg-red-600 p-2 text-center text-xs text-white">GPS: {geoError}</div>}

        {offer && (
          <div className="absolute inset-x-0 bottom-0 z-[600] animate-slideup p-3">
            <div className="overflow-hidden rounded-3xl bg-ink-900 text-white shadow-2xl">
              <div className="h-1 bg-white/10"><div className="h-full bg-brand-500 transition-all" style={{ width: `${100 - ((now - new Date(offer.created_at).getTime()) / timeout) * 100}%` }} /></div>
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {offer.shipments.business
                      ? <Avatar src={offer.shipments.business.logo_url} name={offer.shipments.business.business_name} size={32} square />
                      : <Avatar src={offer.shipments.sender?.avatar_url} name={offer.shipments.sender?.full_name} size={32} />}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-brand-400">{t("new_offer")} <span className="chip ms-1 bg-white/10 px-1.5 py-0.5 text-[10px] text-white">{tm(`type_${offer.shipments.delivery_type ?? "b2c"}`)}</span></div>
                      <div className="truncate text-xs text-slate-300">
                        {offer.shipments.business?.business_name || offer.shipments.sender?.full_name} · {offer.shipments.business ? tm("sender_business") : tm("sender_individual")}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{offer.distance_km} {t("km")} {t("away")}</div>
                </div>
                <div className="mb-4 flex items-end justify-between">
                  <div><div className="text-xs text-slate-400">{t("earn")}</div><div className="text-4xl font-extrabold tabular-nums">{money(offer.shipments.courier_earning)}</div></div>
                  <div className="text-end text-sm text-slate-300">{offer.shipments.distance_km} {t("km")} · {t(offer.shipments.package_size)}{offer.shipments.is_fragile ? " · ⚠️" : ""}</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-brand-400" /><span className="truncate">{offer.shipments.pickup_address}</span></div>
                  <div className="flex gap-2"><Navigation className="h-4 w-4 shrink-0 text-red-400" /><span className="truncate">{offer.shipments.dropoff_address}</span></div>
                  {offer.shipments.cod_amount > 0 && <div className="flex gap-2 text-amber-300"><Banknote className="h-4 w-4" />{t("collect_cash")}: {money(offer.shipments.cod_amount)}</div>}
                </div>
                {msg && <div className="mt-3 rounded-lg bg-red-500/20 p-2 text-center text-sm text-red-200">{msg}</div>}
                <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
                  <button onClick={() => decline(offer)} className="btn bg-white/10 py-3.5 text-white">{t("decline")}</button>
                  <button disabled={busy || !!active} onClick={() => accept(offer)} className="btn-primary py-3.5 text-base">{t("accept")} · {Math.max(0, Math.ceil((timeout - (now - new Date(offer.created_at).getTime())) / 1000))}s</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {online && !offer && !active && (
        <div className="card mt-4 p-4">
          <div className="mb-2 text-sm font-bold">{tm("why_no_jobs")}</div>
          <ul className="space-y-1.5 text-sm">
            {([
              [verified, tm("chk_approved")],
              [online, tm("chk_online")],
              [!!pos || !!status?.has_location, pos ? tm("chk_gps") : status?.has_location ? tm("chk_gps_last") : `${tm("chk_gps_none")}${geoError ? ` (${geoError})` : ""}`],
              [!!status, status ? `${tm("chk_seen")} ${Math.max(0, Math.round((now - status.at) / 1000))}s` : tm("chk_seen_never")],
              [(status?.waiting_nearby ?? 0) > 0, `${tm("chk_nearby")}: ${status?.waiting_nearby ?? 0} (≤ ${Number(status?.max_radius_km ?? 20)} ${t("km")})`],
            ] as [boolean, string][]).map(([okay, label]) => (
              <li key={label} className="flex items-center gap-2">
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${okay ? "bg-brand-500" : "bg-slate-300"}`}>{okay ? "✓" : "–"}</span>
                <span className={okay ? "" : "text-slate-500"}>{label}</span>
              </li>
            ))}
          </ul>
          {(status?.waiting_too_big ?? 0) > 0 && <p className="mt-2 text-xs text-amber-700">{tm("chk_too_big")}</p>}
          <p className="mt-2 text-xs text-slate-400">{tm("chk_own_note")}</p>
        </div>
      )}

      {active && (
        <Link href={`/courier/job/${active.id}`} className="card mt-4 flex items-center gap-4 border-brand-300 p-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-2xl">📦</div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2"><span className="text-sm font-bold">{t("active_job")}</span><StatusBadge s={active.status} /></div>
            <div className="truncate text-sm text-slate-500">{active.dropoff_address}</div>
          </div>
          {pos && <div className="text-sm text-slate-400">{haversineKm(pos, { lat: active.dropoff_lat, lng: active.dropoff_lng }).toFixed(1)} {t("km")}</div>}
          <ArrowLeft className="h-5 w-5 ltr:rotate-180" />
        </Link>
      )}
    </AppShell>
  );
}
