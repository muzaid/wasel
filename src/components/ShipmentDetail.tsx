"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, KeyRound, Radar, XCircle } from "lucide-react";
import Map, { MapMarker } from "@/components/Map";
import { CourierCard, CourierInfo, Progress, ShareTracking, Spinner, StatusBadge, Stars, Timeline, vehicleEmoji } from "@/components/ui";
import { useI18n, TKey } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { canCancel as cancellable } from "@/lib/delivery";
import { supabase } from "@/lib/supabase";
import { errKey, useLiveShipment, useSettings } from "@/lib/hooks";
import { etaMin, haversineKm, money } from "@/lib/geo";
import type { Courier, Profile } from "@/lib/types";

/** Live view of one delivery for its sender (business member or individual customer). */
export default function ShipmentDetail({ id, backHref }: { id: string; backHref: string }) {
  const { t } = useI18n();
  const { tm } = useTm();
  const settings = useSettings();
  const { shipment: s, events, courierPos, trail, offers } = useLiveShipment(id);
  const [courier, setCourier] = useState<(CourierInfo & { lat: number | null; lng: number | null }) | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  // load courier details when assigned
  useEffect(() => {
    if (!s?.courier_id) { setCourier(null); return; }
    Promise.all([
      supabase.from("couriers").select("*").eq("id", s.courier_id).single(),
      supabase.from("profiles").select("*").eq("id", s.courier_id).single(),
    ]).then(([{ data: c }, { data: p }]) => {
      const co = c as Courier, pr = p as Profile;
      if (co && pr) setCourier({ name: pr.full_name, phone: pr.phone, avatar_url: pr.avatar_url, vehicle: co.vehicle, vehicle_model: co.vehicle_model, vehicle_color: co.vehicle_color, plate_number: co.plate_number, rating: co.rating_avg, deliveries: co.total_deliveries, lat: co.lat, lng: co.lng });
    });
    supabase.from("ratings").select("id").eq("shipment_id", s.id).eq("rater", "business").then(({ data }) => setRated(!!data?.length));
  }, [s?.courier_id, s?.id]);

  // auto widen radius while searching
  useEffect(() => {
    if (!s || s.status !== "searching" || !settings) return;
    const last = new Date(s.last_dispatch_at ?? s.created_at).getTime();
    if (now - last > settings.offer_timeout_sec * 1000) supabase.rpc("expand_dispatch", { p_id: s.id });
  }, [now, s, settings]);

  const pos = courierPos ?? (courier?.lat && courier.lng ? { lat: courier.lat, lng: courier.lng } : null);
  const target = s && (["accepted", "arrived_pickup"].includes(s.status) ? { lat: s.pickup_lat, lng: s.pickup_lng } : { lat: s.dropoff_lat, lng: s.dropoff_lng });
  const eta = pos && target && s && s.status !== "delivered" ? etaMin(haversineKm(pos, target) * 1.3, courier?.vehicle) : null;

  const markers = useMemo<MapMarker[]>(() => !s ? [] : [
    { id: "p", kind: "pickup", lat: s.pickup_lat, lng: s.pickup_lng, popup: s.pickup_address },
    { id: "d", kind: "dropoff", lat: s.dropoff_lat, lng: s.dropoff_lng, popup: s.dropoff_address },
    ...(pos && s.status !== "delivered" && s.courier_id ? [{ id: "c", kind: "courier" as const, ...pos, emoji: vehicleEmoji(courier?.vehicle) }] : []),
  ], [s, pos, courier?.vehicle]);

  if (!s) return <Spinner />;

  const cancel = async () => {
    const { error } = await supabase.rpc("cancel_shipment", { p_id: s.id, p_reason: reason });
    if (error) alert(t(errKey(error.message) as TKey)); else setCancelOpen(false);
  };
  const rate = async () => {
    await supabase.rpc("rate_shipment", { p_id: s.id, p_stars: stars, p_comment: comment || null }); setRated(true);
  };
  const canCancel = cancellable(s.status);
  const searchSec = Math.floor((now - new Date(s.created_at).getTime()) / 1000);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={backHref} className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm"><ArrowRight className="h-4 w-4 ltr:rotate-180" /></Link>
        <h1 className="text-xl font-extrabold">#{s.code}</h1>
        <StatusBadge s={s.status} />
        <span className="chip bg-ink-900 text-white" title={tm(`type_${s.delivery_type ?? "b2c"}_long`)}>{tm(`type_${s.delivery_type ?? "b2c"}`)}</span>
        <div className="ms-auto text-2xl font-extrabold tabular-nums">{money(s.price)}</div>
      </div>
      <div className="mb-5"><Progress status={s.status} /></div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl">
            <Map markers={markers} line={trail.length > 1 ? trail : undefined} fitKey={`${s.id}-${s.status}`}
              circle={s.status === "searching" ? { lat: s.pickup_lat, lng: s.pickup_lng, km: Number(s.dispatch_radius_km) } : null}
              className="h-[360px] w-full rounded-2xl lg:h-[520px]" />
            {s.status === "searching" && (
              <div className="absolute inset-x-3 bottom-3 z-[500] flex items-center gap-4 rounded-2xl bg-ink-900/95 p-4 text-white shadow-xl">
                <div className="relative grid h-12 w-12 place-items-center">
                  <span className="absolute inset-0 animate-ping2 rounded-full border-2 border-brand-400" />
                  <Radar className="h-6 w-6 text-brand-400" />
                </div>
                <div className="flex-1">
                  <div className="font-bold">{t("searching_title")}</div>
                  <div className="text-xs text-slate-300">{offers} {t("notified")} · {t("radius")} {Number(s.dispatch_radius_km)} {t("km")} · {t("round")} {s.dispatch_round}</div>
                </div>
                <div className="font-mono text-lg tabular-nums">{Math.floor(searchSec / 60)}:{String(searchSec % 60).padStart(2, "0")}</div>
              </div>
            )}
          </div>

          <div className="card grid gap-4 p-5 sm:grid-cols-2">
            <div><div className="text-xs font-bold text-brand-700">A · {t("pickup")}</div><div className="text-sm">{s.pickup_address}</div><div className="text-xs text-slate-400">{s.pickup_contact} {s.pickup_phone}</div></div>
            <div><div className="text-xs font-bold text-red-600">B · {t("dropoff")}</div><div className="text-sm">{s.dropoff_address}</div><div className="text-xs text-slate-400">{s.recipient_name} · <span dir="ltr">{s.recipient_phone}</span></div></div>
            <div className="text-sm"><span className="text-slate-400">{t("package")}:</span> {t(s.package_size)} {s.is_fragile && "· ⚠️"} {s.package_desc}</div>
            <div className="text-sm"><span className="text-slate-400">{t("distance")}:</span> {s.distance_km} {t("km")} {s.cod_amount > 0 && <>· <b className="text-amber-700">COD {money(s.cod_amount)}</b></>}</div>
          </div>
          {s.proof_photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <a href={s.proof_photo_url} target="_blank" rel="noreferrer"><img src={s.proof_photo_url} alt="proof" className="h-48 w-full rounded-2xl object-cover" /></a>
          )}
        </div>

        <div className="space-y-4">
          {courier && !["cancelled", "expired"].includes(s.status) && <CourierCard c={courier} eta={eta} />}
          {!["delivered", "cancelled", "expired"].includes(s.status) && (
            <div className="card flex items-center gap-3 bg-ink-900 p-4 text-white">
              <KeyRound className="h-5 w-5 text-brand-400" />
              <div className="flex-1 text-xs text-slate-300">{t("give_code")}</div>
              <div dir="ltr" className="font-mono text-2xl font-bold tracking-[.3em]">{s.delivery_otp}</div>
            </div>
          )}
          {!["cancelled", "expired"].includes(s.status) && <ShareTracking token={s.tracking_token} recipientPhone={s.recipient_phone} code={s.code} />}

          {s.status === "delivered" && !rated && (
            <div className="card space-y-3 p-5">
              <div className="font-bold">{t("rate_courier")}</div>
              <Stars value={stars} onChange={setStars} size={30} />
              <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
              <button onClick={rate} className="btn-primary w-full">{t("submit")}</button>
            </div>
          )}
          {s.status === "delivered" && rated && <div className="card p-4 text-center font-semibold text-brand-700">✓ {t("thanks")}</div>}

          <div className="card p-5"><div className="mb-3 font-bold">{t("timeline")}</div><Timeline events={events} /></div>

          {canCancel && !cancelOpen && <button onClick={() => setCancelOpen(true)} className="btn-danger w-full"><XCircle className="h-4 w-4" />{t("cancel_shipment")}</button>}
          {cancelOpen && (
            <div className="card space-y-2 p-4">
              <input className="input" placeholder={t("cancel_reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2"><button onClick={cancel} className="btn-danger flex-1">{t("confirm")}</button><button onClick={() => setCancelOpen(false)} className="btn-ghost">{t("back")}</button></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
