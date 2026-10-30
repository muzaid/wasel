"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Loader2, Radar } from "lucide-react";
import AppShell from "@/components/AppShell";
import Map from "@/components/Map";
import AddressField, { Place } from "@/components/AddressField";
import { Spinner, vehicleEmoji } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/hooks";
import { etaMin, money, quote, reverseGeocode, roadKm } from "@/lib/geo";
import type { PackageSize, Vehicle } from "@/lib/types";

const SIZES: PackageSize[] = ["small", "medium", "large", "xlarge"];
const SIZE_ICON: Record<PackageSize, string> = { small: "✉️", medium: "📦", large: "🗃️", xlarge: "🛋️" };
const VEHICLES: Vehicle[] = ["bike", "motorcycle", "car", "van"];
const MIN_VEHICLE: Record<PackageSize, Vehicle> = { small: "bike", medium: "motorcycle", large: "car", xlarge: "van" };

interface Saved { id: number; label: string; address: string; lat: number; lng: number; contact_name: string | null; phone: string | null }

export default function NewShipment() {
  const ok = useRequireRole("business");
  const { session, profile, business } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();
  const settings = useSettings();
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [f, setF] = useState({
    pickup_contact: "", pickup_phone: "", recipient_name: "", recipient_phone: "", package_desc: "", weight_kg: "",
    package_size: "small" as PackageSize, vehicle: "motorcycle" as Vehicle, is_fragile: false, cod_amount: "", notes: "", scheduled_at: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!session) return;
    supabase.from("saved_addresses").select("*").eq("business_id", session.user.id).then(({ data }) => setSaved((data as Saved[]) ?? []));
  }, [session]);
  useEffect(() => {
    if (business?.lat && business.lng && !pickup) setPickup({ address: business.address || business.business_name, lat: business.lat, lng: business.lng });
    if (profile && !f.pickup_contact) setF((x) => ({ ...x, pickup_contact: business?.business_name || profile.full_name, pickup_phone: profile.phone || "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business, profile]);

  const km = pickup && dropoff ? roadKm(pickup, dropoff) : 0;
  const q = settings && km ? quote(settings, km, f.package_size, f.vehicle, f.is_fragile, Number(f.cod_amount) || 0) : null;

  const markers = useMemo(() => [
    ...(pickup ? [{ id: "p", kind: "pickup" as const, ...pickup }] : []),
    ...(dropoff ? [{ id: "d", kind: "dropoff" as const, ...dropoff }] : []),
  ], [pickup, dropoff]);

  const onPick = async (lat: number, lng: number) => {
    const p = { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    const setter = mode === "pickup" ? setPickup : setDropoff;
    setter(p);
    if (mode === "pickup" && !dropoff) setMode("dropoff");
    setter({ ...p, address: await reverseGeocode(lat, lng, lang) });
  };

  const setSize = (s: PackageSize) => {
    const min = MIN_VEHICLE[s];
    setF((x) => ({ ...x, package_size: s, vehicle: VEHICLES.indexOf(x.vehicle) < VEHICLES.indexOf(min) ? min : x.vehicle }));
  };

  const savePickup = async () => {
    if (!pickup || !session) return;
    const label = prompt(t("label"), "🏪") || "📍";
    const { data } = await supabase.from("saved_addresses").insert({ business_id: session.user.id, label, address: pickup.address, lat: pickup.lat, lng: pickup.lng, contact_name: f.pickup_contact, phone: f.pickup_phone }).select().single();
    if (data) setSaved((s) => [...s, data as Saved]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !dropoff || !session) return;
    setBusy(true); setErr("");
    const { data, error } = await supabase.from("shipments").insert({
      business_id: session.user.id,
      pickup_address: pickup.address, pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_contact: f.pickup_contact, pickup_phone: f.pickup_phone,
      dropoff_address: dropoff.address, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      recipient_name: f.recipient_name, recipient_phone: f.recipient_phone, package_size: f.package_size, package_desc: f.package_desc || null,
      weight_kg: f.weight_kg ? Number(f.weight_kg) : null, vehicle: f.vehicle, is_fragile: f.is_fragile, cod_amount: Number(f.cod_amount) || 0,
      notes: f.notes || null, scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null,
    }).select("id").single();
    if (error || !data) { setErr(error?.message || t("error")); setBusy(false); return; }
    await supabase.rpc("dispatch_shipment", { p_id: data.id });
    router.replace(`/business/shipments/${data.id}`);
  };

  if (!ok) return <AppShell><Spinner /></AppShell>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <AppShell wide>
      <h1 className="mb-5 text-2xl font-extrabold">{t("new_shipment")}</h1>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="space-y-5 lg:order-2">
          <div className="lg:sticky lg:top-20">
            <Map markers={markers} line={pickup && dropoff ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] : undefined}
              onPick={onPick} fitKey={`${pickup?.lat}-${dropoff?.lat}`} className="h-72 w-full rounded-2xl lg:h-[420px]" />
            {q && (
              <div className="card mt-4 p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-sm text-slate-500">{t("price")}</div>
                    <div className="text-4xl font-extrabold tabular-nums text-brand-700">{money(q.price)}</div>
                  </div>
                  <div className="text-end text-sm text-slate-500">
                    <div>{t("distance")}: <b className="text-ink-900">{km} {t("km")}</b></div>
                    <div>~{etaMin(km, f.vehicle)} {t("min")}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-1 border-t pt-3 text-xs text-slate-500">
                  <div className="flex justify-between"><span>{t("courier_gets")}</span><span className="tabular-nums">{money(q.courier)}</span></div>
                  <div className="flex justify-between"><span>{t("platform_fee")}</span><span className="tabular-nums">{money(q.fee)}</span></div>
                  {Number(f.cod_amount) > 0 && <div className="flex justify-between text-amber-700"><span>COD</span><span className="tabular-nums">{money(f.cod_amount)}</span></div>}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                  <Radar className="h-4 w-4 text-brand-600" />
                  {settings?.dispatch_count} × {t("courier")} · {t("radius")} {settings?.initial_radius_km}–{settings?.max_radius_km} {t("km")}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5 lg:order-1">
          <section className="card space-y-3 p-5">
            {saved.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {saved.map((s) => (
                  <button type="button" key={s.id} className="chip bg-slate-100 text-slate-700 hover:bg-brand-50"
                    onClick={() => { setPickup({ address: s.address, lat: s.lat, lng: s.lng }); setF((x) => ({ ...x, pickup_contact: s.contact_name || x.pickup_contact, pickup_phone: s.phone || x.pickup_phone })); setMode("dropoff"); }}>
                    {s.label} {s.address.slice(0, 24)}
                  </button>
                ))}
              </div>
            )}
            <AddressField kind="pickup" value={pickup} onChange={(p) => { setPickup(p); setMode("dropoff"); }} active={mode === "pickup"} onFocus={() => setMode("pickup")} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder={t("contact_name")} value={f.pickup_contact} onChange={set("pickup_contact")} />
              <input className="input" dir="ltr" placeholder={t("phone")} value={f.pickup_phone} onChange={set("pickup_phone")} />
            </div>
            {pickup && <button type="button" onClick={savePickup} className="flex items-center gap-1 text-xs font-semibold text-brand-700"><Bookmark className="h-3.5 w-3.5" />{t("save_address")}</button>}
            <AddressField kind="dropoff" value={dropoff} onChange={setDropoff} active={mode === "dropoff"} onFocus={() => setMode("dropoff")} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" required placeholder={t("recipient_name")} value={f.recipient_name} onChange={set("recipient_name")} />
              <input className="input" required dir="ltr" type="tel" placeholder={t("recipient_phone")} value={f.recipient_phone} onChange={set("recipient_phone")} />
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <div>
              <label className="label">{t("size")}</label>
              <div className="grid grid-cols-4 gap-2">
                {SIZES.map((s) => (
                  <button type="button" key={s} onClick={() => setSize(s)}
                    className={`rounded-xl border-2 p-2.5 text-center transition ${f.package_size === s ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                    <div className="text-2xl">{SIZE_ICON[s]}</div>
                    <div className="text-xs font-bold">{t(s)}</div>
                    <div className="hidden text-[10px] text-slate-400 sm:block">{t(`size_hint_${s}` as TKey)}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">{t("required_vehicle")}</label>
              <div className="grid grid-cols-4 gap-2">
                {VEHICLES.map((v) => {
                  const disabled = VEHICLES.indexOf(v) < VEHICLES.indexOf(MIN_VEHICLE[f.package_size]);
                  return (
                    <button type="button" key={v} disabled={disabled} onClick={() => setF({ ...f, vehicle: v })}
                      className={`rounded-xl border-2 p-2 text-center text-xs font-semibold transition disabled:opacity-30 ${f.vehicle === v ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                      <div className="text-xl">{vehicleEmoji(v)}</div>{t(v)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">{t("description")}</label><input className="input" value={f.package_desc} onChange={set("package_desc")} /></div>
              <div><label className="label">{t("weight")}</label><input className="input" type="number" step="0.1" min="0" value={f.weight_kg} onChange={set("weight_kg")} /></div>
              <div><label className="label">{t("cod")}</label><input className="input" type="number" step="1" min="0" value={f.cod_amount} onChange={set("cod_amount")} /></div>
              <div className="col-span-2"><label className="label">{t("notes")}</label><textarea className="input" rows={2} value={f.notes} onChange={set("notes")} /></div>
              <div><label className="label">{t("schedule")}</label><input className="input" type="datetime-local" value={f.scheduled_at} onChange={set("scheduled_at")} /></div>
              <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 p-2.5 text-sm font-semibold">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.is_fragile} onChange={(e) => setF({ ...f, is_fragile: e.target.checked })} />⚠️ {t("fragile")}
              </label>
            </div>
          </section>

          {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
          <button className="btn-primary w-full py-4 text-base" disabled={busy || !pickup || !dropoff}>
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" />{t("posting")}</> : <><Radar className="h-5 w-5" />{t("post_shipment")} {q ? `· ${money(q.price)}` : ""}</>}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
