"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { money, quote } from "@/lib/geo";
import type { PackageSize, Settings, Vehicle } from "@/lib/types";

export default function AdminSettings() {
  const ok = useRequireRole("admin");
  const { t } = useI18n();
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { if (ok) supabase.from("settings").select("*").eq("id", 1).single().then(({ data }) => setS(data as Settings)); }, [ok]);
  if (!ok || !s) return <AppShell><Spinner /></AppShell>;

  const num = (k: keyof Settings, label: TKey, step = 0.5, hint?: string) => (
    <div>
      <label className="label">{t(label)}</label>
      <input className="input tabular-nums" type="number" step={step} value={s[k] as number} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} />
      {hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
  const save = async () => {
    const { error } = await supabase.from("settings").update({ ...s }).eq("id", 1);
    setMsg(error ? error.message : t("saved")); setTimeout(() => setMsg(""), 2500);
  };
  const sample = quote(s, 5, "small", "motorcycle", false, 0);

  return (
    <AppShell>
      <h1 className="mb-5 text-2xl font-extrabold">{t("settings")}</h1>
      <div className="space-y-5">
        <section className="card border-brand-300 p-5">
          <div className="mb-3 font-bold">💰 {t("platform_fee")}</div>
          <div className="grid gap-4 md:grid-cols-2">{num("platform_fee", "platform_fee", 0.5, t("platform_fee_hint"))}</div>
        </section>
        <section className="card p-5">
          <div className="mb-3 font-bold">{t("pricing")}</div>
          <div className="grid gap-4 md:grid-cols-3">
            {num("base_fare", "base_fare")}{num("per_km", "per_km")}{num("min_fare", "min_fare")}{num("fragile_fee", "fragile_fee")}{num("cod_fee", "cod_fee")}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="label">{t("size_mult")}</div>
              <div className="grid grid-cols-4 gap-2">
                {(["small", "medium", "large", "xlarge"] as PackageSize[]).map((k) => (
                  <div key={k}><div className="text-[11px] text-slate-500">{t(k)}</div>
                    <input className="input px-2" type="number" step="0.1" value={s.size_mult[k]} onChange={(e) => setS({ ...s, size_mult: { ...s.size_mult, [k]: Number(e.target.value) } })} /></div>
                ))}
              </div>
            </div>
            <div>
              <div className="label">{t("vehicle_mult")}</div>
              <div className="grid grid-cols-4 gap-2">
                {(["bike", "motorcycle", "car", "van"] as Vehicle[]).map((k) => (
                  <div key={k}><div className="text-[11px] text-slate-500">{t(k)}</div>
                    <input className="input px-2" type="number" step="0.1" value={s.vehicle_mult[k]} onChange={(e) => setS({ ...s, vehicle_mult: { ...s.vehicle_mult, [k]: Number(e.target.value) } })} /></div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">5 {t("km")} · {t("small")} · {t("motorcycle")} → <b>{money(sample.price)}</b> ({t("courier_gets")} {money(sample.courier)} · {t("platform_fee")} {money(sample.fee)})</div>
        </section>
        <section className="card p-5">
          <div className="mb-3 font-bold">{t("dispatch")}</div>
          <div className="grid gap-4 md:grid-cols-3">
            {num("dispatch_count", "dispatch_count", 1)}{num("initial_radius_km", "initial_radius", 0.5)}{num("radius_step_km", "radius_step", 0.5)}{num("max_radius_km", "max_radius", 1)}{num("offer_timeout_sec", "offer_timeout", 5)}
          </div>
        </section>
        <button onClick={save} className="btn-primary w-full py-3.5">{msg || t("save")}</button>
      </div>
    </AppShell>
  );
}
