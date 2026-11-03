"use client";
import { useEffect, useState } from "react";
import { Radar, Star } from "lucide-react";
import { Avatar, vehicleEmoji } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { supabase } from "@/lib/supabase";
import { etaMin, money, quote } from "@/lib/geo";
import type { NearbyCourier, PackageSize, Settings, Vehicle } from "@/lib/types";

interface Props {
  pickup: { lat: number; lng: number } | null;
  vehicle: Vehicle;                      // the vehicle the package needs (minimum)
  km: number; size: PackageSize; fragile: boolean; cod: number;
  settings: Settings | null;
  selected: string | null;               // courier id, or null = send to all
  onSelect: (id: string | null, c?: NearbyCourier) => void;
  onCouriers?: (list: NearbyCourier[]) => void;
}

/** Uber-style list of the 10 nearest available couriers, with rating, vehicle, distance, ETA and price. */
export default function CourierPicker({ pickup, vehicle, km, size, fragile, cod, settings, selected, onSelect, onCouriers }: Props) {
  const { t } = useI18n();
  const { tm } = useTm();
  const [list, setList] = useState<NearbyCourier[] | null>(null);

  useEffect(() => {
    if (!pickup) { setList(null); onCouriers?.([]); return; }
    let alive = true;
    const load = () => supabase.rpc("nearby_couriers", { p_lat: pickup.lat, p_lng: pickup.lng, p_vehicle: vehicle, p_limit: 10 })
      .then(({ data }) => {
        if (!alive) return;
        const rows = (data as NearbyCourier[]) ?? [];
        setList(rows); onCouriers?.(rows);
        if (selected && !rows.some((r) => r.id === selected)) onSelect(null);   // chosen courier went offline / got busy
      });
    load();
    const i = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => { alive = false; clearInterval(i); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, vehicle]);

  const priceFor = (v: Vehicle) => (settings && km ? quote(settings, km, size, v, fragile, cod).price : null);
  const allPrice = priceFor(vehicle);

  return (
    <section className="card space-y-3 p-5">
      <div>
        <div className="font-bold">{tm("choose_courier")}</div>
        <p className="text-xs text-slate-500">{tm("choose_courier_hint")}</p>
      </div>
      {!pickup && <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">{tm("enter_pickup_first")}</div>}
      {pickup && (
        <>
          <button type="button" onClick={() => onSelect(null)}
            className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-start transition ${selected === null ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink-900 text-brand-400"><Radar className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{tm("send_to_all")}{list ? ` (${list.length})` : ""}</div>
              <div className="text-xs text-slate-500">{tm("send_to_all_hint")}</div>
            </div>
            {allPrice !== null && <div className="font-bold tabular-nums">{money(allPrice)}</div>}
          </button>
          {list && list.length === 0 && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{tm("no_couriers_near")}</div>}
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {list?.map((c) => {
              const p = priceFor(c.vehicle);
              const on = selected === c.id;
              return (
                <button type="button" key={c.id} onClick={() => onSelect(c.id, c)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-start transition ${on ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <div className="relative">
                    <Avatar src={c.avatar_url} name={c.full_name} size={44} />
                    <span className="absolute -bottom-1 -end-1 grid h-6 w-6 place-items-center rounded-full bg-white text-sm shadow">{vehicleEmoji(c.vehicle)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.full_name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600"><Star className="h-3 w-3 fill-current" />{Number(c.rating).toFixed(1)}</span>
                      <span>({c.rating_count} {tm("reviews")})</span>
                      <span>· {c.deliveries} {tm("deliveries_n")}</span>
                    </div>
                    <div className="truncate text-xs text-slate-400">{t(c.vehicle)}{c.vehicle_model ? ` · ${c.vehicle_model}` : ""}{c.vehicle_color ? ` · ${c.vehicle_color}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-end">
                    {p !== null && <div className="font-bold tabular-nums">{money(p)}</div>}
                    <div className="text-xs text-slate-500">{etaMin(Number(c.distance_km) * 1.3, c.vehicle)} {tm("min_away")}</div>
                    <div className="text-[11px] text-slate-400">{Number(c.distance_km).toFixed(1)} {t("km")}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
