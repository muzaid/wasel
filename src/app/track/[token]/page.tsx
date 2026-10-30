"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, PackageSearch } from "lucide-react";
import Map, { MapMarker } from "@/components/Map";
import { CourierCard, LangSwitch, Logo, Progress, Spinner, Stars, Timeline, vehicleEmoji } from "@/components/ui";
import { useI18n, TKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { etaMin, haversineKm, money } from "@/lib/geo";
import type { ShipmentStatus, Vehicle } from "@/lib/types";

interface Tracking {
  code: string; status: ShipmentStatus; business_name: string; recipient_name: string; cod_amount: number; delivery_otp: string | null;
  pickup: { address: string; lat: number; lng: number }; dropoff: { address: string; lat: number; lng: number };
  courier: null | { name: string; phone: string | null; avatar_url: string | null; vehicle: Vehicle; vehicle_model: string | null; vehicle_color: string | null; plate_number: string | null; rating: number; deliveries: number; lat: number | null; lng: number | null; last_seen_at: string | null };
  events: { status: ShipmentStatus; at: string }[]; rated: boolean;
}

export default function Track({ params }: { params: { token: string } }) {
  const { t, lang } = useI18n();
  const [d, setD] = useState<Tracking | null | undefined>(undefined);
  const [stars, setStars] = useState(5);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => supabase.rpc("get_tracking", { p_token: params.token }).then(({ data }) => { if (alive) setD((data as Tracking) ?? null); });
    load();
    const i = setInterval(load, 5000);
    return () => { alive = false; clearInterval(i); };
  }, [params.token]);

  const c = d?.courier;
  const pos = c?.lat && c.lng ? { lat: c.lat, lng: c.lng } : null;
  const target = d && (["accepted", "arrived_pickup"].includes(d.status) ? d.pickup : d.dropoff);
  const toDropKm = pos && d ? haversineKm(pos, d.dropoff) * 1.3 : 0;
  const eta = pos && target && d && d.status !== "delivered"
    ? (["accepted", "arrived_pickup"].includes(d.status) ? etaMin(haversineKm(pos, d.pickup) * 1.3 + haversineKm(d.pickup, d.dropoff) * 1.3, c?.vehicle) + 3 : etaMin(toDropKm, c?.vehicle))
    : null;

  const markers = useMemo<MapMarker[]>(() => !d ? [] : [
    { id: "p", kind: "pickup", lat: d.pickup.lat, lng: d.pickup.lng },
    { id: "d", kind: "dropoff", lat: d.dropoff.lat, lng: d.dropoff.lng },
    ...(pos ? [{ id: "c", kind: "courier" as const, ...pos, emoji: vehicleEmoji(c?.vehicle) }] : []),
  ], [d, pos, c?.vehicle]);

  if (d === undefined) return <Spinner />;
  if (d === null) return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div><PackageSearch className="mx-auto mb-3 h-12 w-12 text-slate-300" /><div className="font-bold">{t("not_found")}</div></div>
    </div>
  );

  const rate = async () => { await supabase.rpc("rate_by_token", { p_token: params.token, p_stars: stars, p_comment: null }); setDone(true); };
  const delivered = d.status === "delivered";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between bg-white px-4 py-3 shadow-sm"><Logo size={28} /><LangSwitch /></header>
      <div className="mx-auto max-w-xl space-y-4 p-4">
        <div className="card p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{d.business_name} · #{d.code}</span>
            {!delivered && c && <span className="chip bg-red-50 text-red-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />{t("live")}</span>}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="text-2xl font-extrabold">{delivered && <CheckCircle2 className="me-1 inline h-7 w-7 text-brand-600" />}{t(`st_${d.status}` as TKey)}</div>
            {eta != null && <div className="text-end"><div className="text-xs text-slate-500">{t("eta")}</div><div className="text-2xl font-extrabold text-brand-700">{eta} {t("min")}</div></div>}
          </div>
          <div className="mt-4"><Progress status={d.status} /></div>
        </div>

        {!delivered && <Map markers={markers} fitKey={`${d.status}-${!!pos}`} className="h-80 w-full rounded-2xl" />}

        {c && !delivered && <CourierCard c={c} eta={null} />}

        {d.delivery_otp && (
          <div className="card flex items-center gap-4 bg-ink-900 p-5 text-white">
            <KeyRound className="h-6 w-6 text-brand-400" />
            <div className="flex-1"><div className="font-bold">{t("your_code")}</div><div className="text-xs text-slate-300">{t("give_code")}</div></div>
            <div dir="ltr" className="font-mono text-3xl font-bold tracking-[.3em]">{d.delivery_otp}</div>
          </div>
        )}
        {d.cod_amount > 0 && !delivered && <div className="rounded-2xl bg-amber-50 p-4 text-center text-sm font-semibold text-amber-800">💵 {t("cod")}: {money(d.cod_amount)}</div>}

        {delivered && c && !d.rated && !done && (
          <div className="card space-y-3 p-5 text-center">
            <div className="font-bold">{t("rate_courier")} — {c.name}</div>
            <div className="flex justify-center"><Stars value={stars} onChange={setStars} size={34} /></div>
            <button onClick={rate} className="btn-primary w-full">{t("submit")}</button>
          </div>
        )}
        {(done || (delivered && d.rated)) && <div className="card p-4 text-center font-semibold text-brand-700">✓ {t("thanks")}</div>}

        <div className="card space-y-3 p-5 text-sm">
          <div><span className="font-bold text-brand-700">A</span> <span className="text-slate-400">{t("from")}</span> {d.pickup.address}</div>
          <div><span className="font-bold text-red-600">B</span> <span className="text-slate-400">{t("to")}</span> {d.dropoff.address}</div>
        </div>
        <div className="card p-5"><div className="mb-3 font-bold">{t("timeline")}</div><Timeline events={d.events} /></div>
        {c?.last_seen_at && !delivered && <div className="text-center text-xs text-slate-400">{t("last_update")}: {new Date(c.last_seen_at).toLocaleTimeString(lang === "en" ? "en-GB" : lang)}</div>}
        <div className="pb-6 text-center text-xs text-slate-400">{t("powered_by")}</div>
      </div>
    </div>
  );
}
