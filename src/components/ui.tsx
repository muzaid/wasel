"use client";
import { useState } from "react";
import { Bike, Car, Check, Copy, MessageCircle, Phone, Star, Truck, Smartphone } from "lucide-react";
import { useI18n, Lang, TKey } from "@/lib/i18n";
import type { ShipmentStatus, Vehicle } from "@/lib/types";

export function Logo({ size = 32, light = false }: { size?: number; light?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-2 font-extrabold tracking-tight">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <rect width="40" height="40" rx="11" fill="#059669" />
        <path d="M9 13l5 15 6-11 6 11 5-15" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="31" cy="11" r="3" fill="#f59e0b" />
      </svg>
      <span className={light ? "text-white text-lg" : "text-ink-900 text-lg"}>{t("app")}</span>
    </span>
  );
}

export function LangSwitch({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();
  const opts: [Lang, string][] = [["ar", "ع"], ["en", "EN"], ["he", "עב"]];
  return (
    <div className={`inline-flex rounded-full p-0.5 text-xs font-bold ${dark ? "bg-white/10" : "bg-slate-100"}`}>
      {opts.map(([k, l]) => (
        <button key={k} onClick={() => setLang(k)}
          className={`rounded-full px-2.5 py-1 transition ${lang === k ? (dark ? "bg-white text-ink-900" : "bg-white shadow text-ink-900") : dark ? "text-white/70" : "text-slate-500"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

const statusStyle: Record<ShipmentStatus, string> = {
  searching: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  accepted: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  arrived_pickup: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  picked_up: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  in_transit: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
  delivered: "bg-emerald-600 text-white",
  cancelled: "bg-slate-100 text-slate-500",
  expired: "bg-red-50 text-red-600 ring-1 ring-red-200",
};
export function StatusBadge({ s }: { s: ShipmentStatus }) {
  const { t } = useI18n();
  return (
    <span className={`chip ${statusStyle[s]}`}>
      {s === "searching" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
      {t(`st_${s}` as TKey)}
    </span>
  );
}

export function VehicleIcon({ v, className = "h-4 w-4" }: { v: Vehicle; className?: string }) {
  if (v === "car") return <Car className={className} />;
  if (v === "van") return <Truck className={className} />;
  return <Bike className={className} />;
}
export const vehicleEmoji = (v?: Vehicle | null) => ({ bike: "🚲", motorcycle: "🛵", car: "🚗", van: "🚐" }[v ?? "motorcycle"]);

export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <div className="inline-flex gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className="disabled:cursor-default">
          <Star style={{ width: size, height: size }} className={n <= Math.round(value) ? "fill-accent text-accent" : "text-slate-300"} />
        </button>
      ))}
    </div>
  );
}

const FLOW: ShipmentStatus[] = ["searching", "accepted", "arrived_pickup", "picked_up", "in_transit", "delivered"];
export function Progress({ status }: { status: ShipmentStatus }) {
  const { t } = useI18n();
  const idx = FLOW.indexOf(status);
  if (idx < 0) return null;
  return (
    <ol className="flex items-center gap-1">
      {FLOW.map((s, i) => (
        <li key={s} className="flex-1" title={t(`st_${s}` as TKey)}>
          <div className={`h-1.5 rounded-full ${i <= idx ? "bg-brand-500" : "bg-slate-200"} ${i === idx && status !== "delivered" ? "animate-pulse" : ""}`} />
        </li>
      ))}
    </ol>
  );
}

export function Timeline({ events }: { events: { status: ShipmentStatus; created_at?: string; at?: string; note?: string | null }[] }) {
  const { t, lang } = useI18n();
  return (
    <ol className="relative space-y-4 ps-5 before:absolute before:inset-y-1 before:start-[7px] before:w-0.5 before:bg-slate-200">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span className={`absolute -start-5 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${i === events.length - 1 ? "bg-brand-500 ring-4 ring-brand-100" : "bg-slate-300"}`} />
          <div className="text-sm font-semibold">{t(`st_${e.status}` as TKey)}</div>
          <div className="text-xs text-slate-500">
            {new Date(e.created_at ?? e.at ?? "").toLocaleTimeString(lang === "en" ? "en-GB" : lang, { hour: "2-digit", minute: "2-digit" })}
            {e.note && e.note !== "created" ? ` · ${e.note}` : ""}
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface CourierInfo {
  name: string; phone?: string | null; avatar_url?: string | null; vehicle: Vehicle; vehicle_model?: string | null;
  vehicle_color?: string | null; plate_number?: string | null; rating: number; deliveries: number;
}
export function CourierCard({ c, eta }: { c: CourierInfo; eta?: number | null }) {
  const { t } = useI18n();
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          {c.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl">{vehicleEmoji(c.vehicle)}</div>
          )}
          <span className="absolute -bottom-1 -end-1 rounded-full bg-white px-1.5 text-[11px] font-bold shadow">★ {Number(c.rating).toFixed(1)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{c.name}</div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <VehicleIcon v={c.vehicle} /> {t(c.vehicle)} {c.vehicle_model ? `· ${c.vehicle_model}` : ""} {c.vehicle_color ? `· ${c.vehicle_color}` : ""}
          </div>
          <div className="text-xs text-slate-400">{c.deliveries} {t("deliveries")}</div>
        </div>
        {c.plate_number && (
          <div dir="ltr" className="rounded-md border-2 border-ink-900 bg-yellow-300 px-2 py-0.5 font-mono text-sm font-bold tracking-wider">{c.plate_number}</div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {eta != null && (
          <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">{t("eta")} </span><b>{eta} {t("min")}</b>
          </div>
        )}
        {c.phone && (
          <a href={`tel:${c.phone}`} className="btn-primary"><Phone className="h-4 w-4" />{t("call")}</a>
        )}
      </div>
    </div>
  );
}

export function ShareTracking({ token, recipientPhone, code }: { token: string; recipientPhone?: string; code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const base = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const url = `${base}/track/${token}`;
  const msg = `${t("track_title")} #${code}: ${url}`;
  const phone = (recipientPhone || "").replace(/\D/g, "").replace(/^0/, "972");
  return (
    <div className="card p-4">
      <div className="mb-2 text-sm font-bold">{t("share_tracking")}</div>
      <div dir="ltr" className="mb-3 truncate rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">{url}</div>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn-ghost" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? <Check className="h-4 w-4 text-brand-600" /> : <Copy className="h-4 w-4" />}{copied ? t("copied") : t("copy")}
        </button>
        <a className="btn bg-[#25D366] text-white" target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}>
          <MessageCircle className="h-4 w-4" />{t("whatsapp")}
        </a>
        <a className="btn-ghost" href={`sms:${recipientPhone ?? ""}?body=${encodeURIComponent(msg)}`}><Smartphone className="h-4 w-4" />{t("sms")}</a>
      </div>
    </div>
  );
}

/** Round photo with initials fallback (or a square logo when `square`). */
export function Avatar({ src, name, size = 36, square = false }: { src?: string | null; name?: string | null; size?: number; square?: boolean }) {
  const initials = (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const r = square ? "rounded-xl" : "rounded-full";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${r} shrink-0 border border-slate-200 bg-white ${square ? "object-contain p-0.5" : "object-cover"}`} style={{ width: size, height: size }} />
  ) : (
    <span className={`${r} grid shrink-0 place-items-center bg-brand-100 font-bold text-brand-700`} style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>
  );
}

export function Empty({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
      <div className="font-semibold text-slate-600">{title}</div>
      {action}
    </div>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>;
}
