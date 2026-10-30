"use client";
import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { reverseGeocode, searchAddress } from "@/lib/geo";

export interface Place { address: string; lat: number; lng: number }

export default function AddressField({ kind, value, onChange, active, onFocus }: {
  kind: "pickup" | "dropoff"; value: Place | null; onChange: (p: Place) => void; active: boolean; onFocus: () => void;
}) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState(value?.address ?? "");
  const [res, setRes] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const typed = useRef(false);

  useEffect(() => { if (!typed.current) setQ(value?.address ?? ""); }, [value]);

  useEffect(() => {
    if (!typed.current || q.length < 3) { setRes([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => searchAddress(q, lang).then(setRes).catch(() => setRes([])), 450);
  }, [q, lang]);

  const locate = () => navigator.geolocation?.getCurrentPosition(async (p) => {
    const { latitude: lat, longitude: lng } = p.coords;
    onChange({ lat, lng, address: await reverseGeocode(lat, lng, lang) });
  });

  const color = kind === "pickup" ? "bg-brand-600" : "bg-red-500";
  return (
    <div className={`relative rounded-2xl border-2 p-3 transition ${active ? "border-brand-500 bg-brand-50/40" : "border-slate-200 bg-white"}`} onClick={onFocus}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white ${color}`}>{kind === "pickup" ? "A" : "B"}</span>
        <span className="text-xs font-bold text-slate-600">{t(kind)}</span>
        {active && <span className="ms-auto flex items-center gap-1 text-[11px] text-brand-700"><MapPin className="h-3 w-3" />{t("tap_map")}</span>}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-slate-400" />
          <input className="input ps-9" placeholder={t("search_address")} value={q}
            onChange={(e) => { typed.current = true; setQ(e.target.value); }}
            onBlur={() => setTimeout(() => setRes([]), 200)} />
        </div>
        <button type="button" className="btn-ghost px-3" onClick={locate} title={t("use_my_location")}><Crosshair className="h-4 w-4" /></button>
      </div>
      {res.length > 0 && (
        <div className="absolute inset-x-3 top-full z-30 -mt-1 overflow-hidden rounded-xl border bg-white shadow-xl">
          {res.map((r, i) => (
            <button type="button" key={i} className="block w-full border-b px-3 py-2 text-start text-sm last:border-0 hover:bg-slate-50"
              onMouseDown={() => { typed.current = false; setRes([]); onChange({ address: r.label.split(",").slice(0, 3).join(","), lat: r.lat, lng: r.lng }); }}>
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
