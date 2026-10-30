"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, Camera, CheckCircle2, Navigation, Phone, XCircle } from "lucide-react";
import AppShell from "@/components/AppShell";
import Map, { MapMarker } from "@/components/Map";
import { Progress, Spinner, StatusBadge, vehicleEmoji } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { supabase, uploadFile } from "@/lib/supabase";
import { errKey, useLiveShipment } from "@/lib/hooks";
import { haversineKm, money, navLinks } from "@/lib/geo";
import type { ShipmentStatus } from "@/lib/types";
import { useCourier } from "@/components/CourierProvider";

const NEXT: Partial<Record<ShipmentStatus, [ShipmentStatus, TKey]>> = {
  accepted: ["arrived_pickup", "arrived_pickup"],
  arrived_pickup: ["picked_up", "picked_up"],
  picked_up: ["in_transit", "start_trip"],
  in_transit: ["delivered", "deliver"],
};

export default function Job({ params }: { params: { id: string } }) {
  const ok = useRequireRole("courier");
  const { session, courier } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { pos } = useCourier();
  const { shipment: s, reload } = useLiveShipment(params.id);
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const markers = useMemo<MapMarker[]>(() => !s ? [] : [
    { id: "p", kind: "pickup", lat: s.pickup_lat, lng: s.pickup_lng },
    { id: "d", kind: "dropoff", lat: s.dropoff_lat, lng: s.dropoff_lng },
    ...(pos ? [{ id: "me", kind: "courier" as const, ...pos, emoji: vehicleEmoji(courier?.vehicle) }] : []),
  ], [s, pos, courier?.vehicle]);

  if (!ok || !s) return <AppShell><Spinner /></AppShell>;
  if (s.courier_id !== session?.user.id) return <AppShell><div className="card p-8 text-center">{t("already_taken")}</div></AppShell>;

  const toPickup = ["accepted", "arrived_pickup"].includes(s.status);
  const target = toPickup ? { lat: s.pickup_lat, lng: s.pickup_lng } : { lat: s.dropoff_lat, lng: s.dropoff_lng };
  const nav = navLinks(target.lat, target.lng);
  const next = NEXT[s.status];

  const advance = async () => {
    if (!next) return;
    setBusy(true); setErr("");
    let photoUrl: string | null = null;
    try { if (photo && next[0] === "delivered") photoUrl = await uploadFile(session!.user.id, photo, "proof"); } catch { /* photo optional */ }
    const { error } = await supabase.rpc("advance_shipment", { p_id: s.id, p_status: next[0], p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, p_otp: otp || null, p_photo: photoUrl });
    setBusy(false);
    if (error) { setErr(t(errKey(error.message) as TKey)); return; }
    reload();
  };
  const cancel = async () => {
    const { error } = await supabase.rpc("cancel_shipment", { p_id: s.id, p_reason: reason });
    if (error) setErr(t(errKey(error.message) as TKey)); else router.replace("/courier");
  };

  return (
    <AppShell>
      <div className="mb-3 flex items-center gap-3">
        <Link href="/courier" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm"><ArrowRight className="h-4 w-4 ltr:rotate-180" /></Link>
        <h1 className="text-lg font-extrabold">#{s.code}</h1>
        <StatusBadge s={s.status} />
        <div className="ms-auto text-xl font-extrabold text-brand-700">{money(s.courier_earning)}</div>
      </div>
      <div className="mb-4"><Progress status={s.status} /></div>

      <Map markers={markers} fitKey={`${s.status}-${!!pos}`} line={pos && s.status !== "delivered" ? [[pos.lat, pos.lng], [target.lat, target.lng]] : undefined} className="h-[42vh] min-h-[280px] w-full rounded-3xl" />

      {s.status === "delivered" ? (
        <div className="card mt-4 flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-brand-600" />
          <div className="text-xl font-extrabold">{t("st_delivered")}</div>
          <div className="text-3xl font-extrabold text-brand-700">+{money(s.courier_earning)}</div>
          {s.cod_amount > 0 && <div className="text-sm text-amber-700">💵 COD {money(s.cod_amount)}</div>}
          <Link href="/courier" className="btn-primary mt-2 w-full">{t("dashboard")}</Link>
        </div>
      ) : s.status === "cancelled" ? (
        <div className="card mt-4 p-6 text-center font-bold text-red-600">{t("st_cancelled")} {s.cancel_reason && `· ${s.cancel_reason}`}</div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="card p-4">
            <div className={`mb-1 text-xs font-bold ${toPickup ? "text-brand-700" : "text-red-600"}`}>{toPickup ? `A · ${t("pickup")}` : `B · ${t("dropoff")}`}</div>
            <div className="font-semibold">{toPickup ? s.pickup_address : s.dropoff_address}</div>
            <div className="text-sm text-slate-500">{toPickup ? s.pickup_contact : s.recipient_name}{pos && ` · ${(haversineKm(pos, target) * 1.3).toFixed(1)} ${t("km")}`}</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <a href={nav.google} target="_blank" rel="noreferrer" className="btn-ghost"><Navigation className="h-4 w-4" />Maps</a>
              <a href={nav.waze} target="_blank" rel="noreferrer" className="btn-ghost">Waze</a>
              <a href={`tel:${toPickup ? s.pickup_phone : s.recipient_phone}`} className="btn-ghost"><Phone className="h-4 w-4" />{t("call")}</a>
            </div>
          </div>

          <div className="card grid grid-cols-2 gap-2 p-4 text-sm">
            <div><span className="text-slate-400">{t("package")}:</span> {t(s.package_size)} {s.is_fragile && "⚠️"}</div>
            <div><span className="text-slate-400">{t("distance")}:</span> {s.distance_km} {t("km")}</div>
            {s.package_desc && <div className="col-span-2"><span className="text-slate-400">{t("description")}:</span> {s.package_desc}</div>}
            {s.notes && <div className="col-span-2 rounded-lg bg-amber-50 p-2 text-amber-800">📝 {s.notes}</div>}
            {s.cod_amount > 0 && <div className="col-span-2 flex items-center gap-2 rounded-lg bg-amber-100 p-2 font-bold text-amber-900"><Banknote className="h-4 w-4" />{t("collect_cash")}: {money(s.cod_amount)}</div>}
          </div>

          {next?.[0] === "delivered" && (
            <div className="card space-y-3 p-4">
              <label className="label">{t("enter_otp")}</label>
              <input dir="ltr" inputMode="numeric" maxLength={4} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="input text-center font-mono text-3xl tracking-[.5em]" placeholder="••••" />
              <label className="btn-ghost w-full cursor-pointer"><Camera className="h-4 w-4" />{photo ? photo.name : t("proof_photo")}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          )}

          {err && <div className="rounded-xl bg-red-50 p-3 text-center text-sm font-semibold text-red-700">{err}</div>}
          {next && (
            <button onClick={advance} disabled={busy || (next[0] === "delivered" && otp.length !== 4)} className="btn-primary w-full py-4 text-base">
              {t(next[1])}
            </button>
          )}
          {toPickup && !cancelOpen && <button onClick={() => setCancelOpen(true)} className="btn-danger w-full"><XCircle className="h-4 w-4" />{t("cancel")}</button>}
          {cancelOpen && (
            <div className="card space-y-2 p-4">
              <input className="input" placeholder={t("cancel_reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2"><button onClick={cancel} className="btn-danger flex-1">{t("confirm")}</button><button onClick={() => setCancelOpen(false)} className="btn-ghost">{t("back")}</button></div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
