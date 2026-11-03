"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Building2, Loader2, Radar, Search, UserRound } from "lucide-react";
import Map from "@/components/Map";
import AddressField, { Place } from "@/components/AddressField";
import { Avatar, vehicleEmoji } from "@/components/ui";
import CourierPicker from "@/components/CourierPicker";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft";
import { useAuth } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/hooks";
import { deliveryType } from "@/lib/delivery";
import { etaMin, money, quote, reverseGeocode, roadKm } from "@/lib/geo";
import type { NearbyCourier, PackageSize, Vehicle } from "@/lib/types";

const SIZES: PackageSize[] = ["small", "medium", "large", "xlarge"];
const SIZE_ICON: Record<PackageSize, string> = { small: "✉️", medium: "📦", large: "🗃️", xlarge: "🛋️" };
const VEHICLES: Vehicle[] = ["bike", "motorcycle", "car", "van"];
const MIN_VEHICLE: Record<PackageSize, Vehicle> = { small: "bike", medium: "motorcycle", large: "car", xlarge: "van" };

interface Saved { id: number; label: string; address: string; lat: number; lng: number; contact_name: string | null; phone: string | null }
interface Biz { id: string; business_name: string; logo_url: string | null; address: string | null; lat: number; lng: number; phone: string | null }

/**
 * One delivery form for every relationship:
 *  - mode "business": B2C (to a person) or B2B (to another business on Wasel)
 *  - mode "customer": C2C (person to person)
 * The sender sees the nearest couriers (rating, vehicle, ETA, price) and picks one or sends to all.
 * Visitors who are not logged in can fill everything in; the draft is kept while they sign up.
 * The server derives the final delivery type and price; the values shown here are a preview.
 */
interface Draft { pickup: Place | null; dropoff: Place | null; f: Record<string, unknown>; choice: string | null }
export default function DeliveryForm({ mode }: { mode: "business" | "customer" }) {
  const { session, profile, business } = useAuth();
  const { t, lang } = useI18n();
  const { tm } = useTm();
  const router = useRouter();
  const settings = useSettings();
  const [pickup, setPickup] = useState<Place | null>(null);
  const pickupRef = useRef<Place | null>(null);
  pickupRef.current = pickup;
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [mapMode, setMapMode] = useState<"pickup" | "dropoff">("pickup");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [toBusiness, setToBusiness] = useState(false);
  const [bizQ, setBizQ] = useState("");
  const [bizResults, setBizResults] = useState<Biz[]>([]);
  const [recipientBiz, setRecipientBiz] = useState<Biz | null>(null);
  const [f, setF] = useState({
    pickup_contact: "", pickup_phone: "", recipient_name: "", recipient_phone: "", package_desc: "", weight_kg: "",
    package_size: "small" as PackageSize, vehicle: "motorcycle" as Vehicle, is_fragile: false, cod_amount: "", notes: "", scheduled_at: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [choice, setChoice] = useState<string | null>(null);          // chosen courier id, null = send to all
  const [chosen, setChosen] = useState<NearbyCourier | null>(null);
  const [nearby, setNearby] = useState<NearbyCourier[]>([]);
  const [restored, setRestored] = useState(false);

  // details filled in before logging in come back here after sign-up
  useEffect(() => {
    if (mode !== "customer" || !session) return;
    const d = loadDraft<Draft>();
    if (!d) return;
    if (d.pickup) setPickup(d.pickup);
    if (d.dropoff) setDropoff(d.dropoff);
    setF((x) => ({ ...x, ...(d.f as Partial<typeof x>) }));
    setChoice(d.choice ?? null);
    setRestored(true);
    clearDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);
  // like Uber: personal senders start with the pickup at their current location, so nearby couriers show at once
  useEffect(() => {
    if (mode !== "customer" || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (p) => {
      const here = { lat: p.coords.latitude, lng: p.coords.longitude, address: `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}` };
      if (pickupRef.current) return;                    // the sender (or a restored draft) already chose a pickup
      setPickup(here);
      setMapMode("dropoff");
      const address = await reverseGeocode(here.lat, here.lng, lang);
      setPickup((cur) => (cur && cur.lat === here.lat && cur.lng === here.lng ? { ...cur, address } : cur));
    }, () => { /* no GPS permission: the sender sets the pickup */ }, { maximumAge: 300000, timeout: 8000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // a restored draft remembers the courier id: link it to the live list once it loads
  useEffect(() => {
    if (choice && !chosen) { const c = nearby.find((x) => x.id === choice); if (c) setChosen(c); }
  }, [nearby, choice, chosen]);
  const owner = mode === "business" ? { col: "business_id", id: business?.id } : { col: "user_id", id: session?.user.id };

  useEffect(() => {
    if (!owner.id) return;
    supabase.from("saved_addresses").select("*").eq(owner.col, owner.id).then(({ data }) => setSaved((data as Saved[]) ?? []));
  }, [owner.col, owner.id]);

  useEffect(() => {
    if (mode === "business" && business?.lat && business.lng && !pickup)
      setPickup({ address: business.address || business.business_name, lat: business.lat, lng: business.lng });
    if (profile && !f.pickup_contact)
      setF((x) => ({ ...x, pickup_contact: (mode === "business" && business?.business_name) || profile.full_name, pickup_phone: (mode === "business" && business?.phone) || profile.phone || "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business, profile, mode]);

  // B2B: search receiving businesses on the platform
  useEffect(() => {
    if (!toBusiness) return;
    const h = setTimeout(() => {
      supabase.rpc("search_businesses", { p_q: bizQ }).then(({ data }) => setBizResults(((data as Biz[]) ?? []).filter((b) => b.id !== business?.id)));
    }, 300);
    return () => clearTimeout(h);
  }, [bizQ, toBusiness, business?.id]);

  const pickBusiness = (b: Biz) => {
    setRecipientBiz(b); setBizResults([]); setBizQ("");
    setDropoff({ address: b.address || b.business_name, lat: b.lat, lng: b.lng });
    setF((x) => ({ ...x, recipient_name: b.business_name, recipient_phone: b.phone || x.recipient_phone }));
  };

  const km = pickup && dropoff ? roadKm(pickup, dropoff) : 0;
  const priceVehicle = chosen && choice === chosen.id ? chosen.vehicle : f.vehicle;   // price follows the chosen courier's vehicle
  const q = settings && km ? quote(settings, km, f.package_size, priceVehicle, f.is_fragile, Number(f.cod_amount) || 0) : null;
  const type = deliveryType(mode === "business" ? business?.id : null, toBusiness ? recipientBiz?.id : null);

  const markers = useMemo(() => [
    ...(pickup ? [{ id: "p", kind: "pickup" as const, ...pickup }] : []),
    ...(dropoff ? [{ id: "d", kind: "dropoff" as const, ...dropoff }] : []),
    ...nearby.map((c) => ({ id: "c-" + c.id, kind: (choice === c.id ? "courier" : "courier_idle") as "courier" | "courier_idle",
      lat: c.lat, lng: c.lng, emoji: vehicleEmoji(c.vehicle), popup: c.full_name })),
  ], [pickup, dropoff, nearby, choice]);

  const onPick = async (lat: number, lng: number) => {
    if (mapMode === "dropoff" && recipientBiz) return; // B2B destination is the business location
    const p = { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    const setter = mapMode === "pickup" ? setPickup : setDropoff;
    setter(p);
    if (mapMode === "pickup" && !dropoff) setMapMode("dropoff");
    setter({ ...p, address: await reverseGeocode(lat, lng, lang) });
  };

  const setSize = (s: PackageSize) => {
    const min = MIN_VEHICLE[s];
    setF((x) => ({ ...x, package_size: s, vehicle: VEHICLES.indexOf(x.vehicle) < VEHICLES.indexOf(min) ? min : x.vehicle }));
  };

  const savePickup = async () => {
    if (!pickup || !owner.id) return;
    const label = prompt(t("label"), mode === "business" ? "🏪" : "🏠") || "📍";
    const { data } = await supabase.from("saved_addresses").insert({ [owner.col]: owner.id, label, address: pickup.address, lat: pickup.lat, lng: pickup.lng, contact_name: f.pickup_contact, phone: f.pickup_phone }).select().single();
    if (data) setSaved((s) => [...s, data as Saved]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !dropoff) return;
    if (!session) {   // visitor: keep the details and ask them to sign up / log in
      saveDraft({ pickup, dropoff, f, choice } satisfies Draft);
      router.push("/signup?next=" + encodeURIComponent("/customer/new"));
      return;
    }
    if (mode === "business" && !business) return;
    if (toBusiness && !recipientBiz) { setErr(tm("search_business")); return; }
    setBusy(true); setErr("");
    const { data, error } = await supabase.from("shipments").insert({
      sender_id: session.user.id,
      business_id: mode === "business" ? business!.id : null,
      recipient_business_id: mode === "business" && toBusiness ? recipientBiz!.id : null,
      pickup_address: pickup.address, pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_contact: f.pickup_contact, pickup_phone: f.pickup_phone,
      dropoff_address: dropoff.address, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      recipient_name: f.recipient_name, recipient_phone: f.recipient_phone, package_size: f.package_size, package_desc: f.package_desc || null,
      weight_kg: f.weight_kg ? Number(f.weight_kg) : null, vehicle: f.vehicle, is_fragile: f.is_fragile, cod_amount: Number(f.cod_amount) || 0,
      notes: f.notes || null, scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null,
      dispatch_mode: choice ? "direct" : "broadcast",
    }).select("id").single();
    if (error || !data) { setErr(error?.message || t("error")); setBusy(false); return; }
    if (choice) {
      const { error: rq } = await supabase.rpc("request_courier", { p_id: data.id, p_courier: choice });
      if (rq) await supabase.rpc("broadcast_shipment", { p_id: data.id });   // courier just went offline/busy: ask everyone
    } else {
      await supabase.rpc("dispatch_shipment", { p_id: data.id });
    }
    router.replace(`/${mode}/shipments/${data.id}`);
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_440px]">
      {restored && <div className="rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-800 lg:col-span-2">✓ {tm("draft_restored")}</div>}
      <div className="space-y-5 lg:order-2">
        <div className="lg:sticky lg:top-20">
          <Map markers={markers} line={pickup && dropoff ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] : undefined}
            onPick={onPick} fitKey={`${pickup?.lat}-${dropoff?.lat}`} className="h-72 w-full rounded-2xl lg:h-[420px]" />
          {q && (
            <div className="card mt-4 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">{t("price")}
                    <span className="chip bg-ink-900 text-white">{tm(`type_${type}`)}</span></div>
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
                  onClick={() => { setPickup({ address: s.address, lat: s.lat, lng: s.lng }); setF((x) => ({ ...x, pickup_contact: s.contact_name || x.pickup_contact, pickup_phone: s.phone || x.pickup_phone })); setMapMode("dropoff"); }}>
                  {s.label} {s.address.slice(0, 24)}
                </button>
              ))}
            </div>
          )}
          <AddressField kind="pickup" value={pickup} onChange={(p) => { setPickup(p); setMapMode("dropoff"); }} active={mapMode === "pickup"} onFocus={() => setMapMode("pickup")} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder={t("contact_name")} value={f.pickup_contact} onChange={set("pickup_contact")} />
            <input className="input" dir="ltr" placeholder={t("phone")} value={f.pickup_phone} onChange={set("pickup_phone")} />
          </div>
          {pickup && <button type="button" onClick={savePickup} className="flex items-center gap-1 text-xs font-semibold text-brand-700"><Bookmark className="h-3.5 w-3.5" />{t("save_address")}</button>}

          {mode === "business" && (
            <div>
              <label className="label">{tm("recipient_type")}</label>
              <div className="grid grid-cols-2 gap-2">
                {([[false, tm("to_person"), <UserRound key="p" className="h-4 w-4" />], [true, tm("to_business"), <Building2 key="b" className="h-4 w-4" />]] as const).map(([v, l, ic]) => (
                  <button type="button" key={String(v)} onClick={() => { setToBusiness(v); if (!v) setRecipientBiz(null); }}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-2.5 text-sm font-semibold ${toBusiness === v ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500"}`}>
                    {ic}{l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {toBusiness ? (
            <div className="relative rounded-2xl border-2 border-slate-200 p-3">
              {recipientBiz ? (
                <div className="flex items-center gap-3">
                  <Avatar src={recipientBiz.logo_url} name={recipientBiz.business_name} size={40} square />
                  <div className="min-w-0 flex-1"><div className="font-bold">{recipientBiz.business_name}</div><div className="truncate text-xs text-slate-500">{recipientBiz.address}</div></div>
                  <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => { setRecipientBiz(null); setDropoff(null); }}>{t("change_photo")}</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-slate-400" />
                    <input className="input ps-9" placeholder={tm("search_business")} value={bizQ} onChange={(e) => setBizQ(e.target.value)} />
                  </div>
                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                    {bizResults.map((b) => (
                      <button type="button" key={b.id} onClick={() => pickBusiness(b)} className="flex w-full items-center gap-3 rounded-xl p-2 text-start hover:bg-slate-50">
                        <Avatar src={b.logo_url} name={b.business_name} size={32} square />
                        <div className="min-w-0"><div className="text-sm font-semibold">{b.business_name}</div><div className="truncate text-xs text-slate-400">{b.address}</div></div>
                      </button>
                    ))}
                    {bizResults.length === 0 && <div className="p-2 text-center text-xs text-slate-400">{tm("no_business_found")}</div>}
                  </div>
                </>
              )}
            </div>
          ) : (
            <AddressField kind="dropoff" value={dropoff} onChange={setDropoff} active={mapMode === "dropoff"} onFocus={() => setMapMode("dropoff")} />
          )}
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

        <CourierPicker pickup={pickup} vehicle={f.vehicle} km={km} size={f.package_size} fragile={f.is_fragile} cod={Number(f.cod_amount) || 0}
          settings={settings} selected={choice} onSelect={(id, c) => { setChoice(id); setChosen(c ?? null); }} onCouriers={setNearby} />

        {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        {!session && <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">{tm("login_to_send")}</div>}
        <button className="btn-primary w-full py-4 text-base" disabled={busy || !pickup || !dropoff || (mode === "business" && !business)}>
          {busy ? <><Loader2 className="h-5 w-5 animate-spin" />{t("posting")}</>
            : <><Radar className="h-5 w-5" />{choice && chosen ? `${tm("request_courier")} ${chosen.full_name}` : tm("send_to_all")} {q ? `· ${money(q.price)}` : ""}</>}
        </button>
      </div>
    </form>
  );
}
