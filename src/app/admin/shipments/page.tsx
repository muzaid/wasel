"use client";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Spinner, StatusBadge } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/geo";
import type { Shipment, ShipmentStatus } from "@/lib/types";

function AdminShipmentsInner() {
  const ok = useRequireRole("admin");
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const [list, setList] = useState<Shipment[] | null>(null);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [st, setSt] = useState<ShipmentStatus | "">("");
  const [open, setOpen] = useState<string | null>(null);

  const load = () => supabase.from("shipments").select("*").order("created_at", { ascending: false }).limit(1000).then(({ data }) => setList((data as Shipment[]) ?? []));
  useEffect(() => { if (ok) load(); }, [ok]);

  const filtered = useMemo(() => (list ?? []).filter((s) => (!st || s.status === st) &&
    (!q || [s.code, s.recipient_name, s.recipient_phone, s.pickup_address, s.dropoff_address].some((x) => x?.toLowerCase().includes(q.toLowerCase())))), [list, q, st]);

  if (!ok || !list) return <AppShell wide><Spinner /></AppShell>;
  const act = async (fn: string, args: Record<string, unknown>) => { const { error } = await supabase.rpc(fn, args); if (error) alert(error.message); load(); };

  return (
    <AppShell wide>
      <h1 className="mb-4 text-2xl font-extrabold">{t("shipments")} <span className="text-base text-slate-400">({filtered.length})</span></h1>
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[12rem]" value={st} onChange={(e) => setSt(e.target.value as ShipmentStatus)}>
          <option value="">{t("all")}</option>
          {(["searching", "accepted", "arrived_pickup", "picked_up", "in_transit", "delivered", "cancelled", "expired"] as ShipmentStatus[]).map((s) => <option key={s} value={s}>{t(`st_${s}` as TKey)}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="p-3 text-start">{t("code")}</th><th className="p-3 text-start">{t("status")}</th><th className="p-3 text-start">{t("pickup")} → {t("dropoff")}</th><th className="p-3 text-end">{t("price")}</th><th className="p-3 text-end">{t("platform_fee")}</th><th className="p-3 text-start">{t("date")}</th></tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <Fragment key={s.id}>
                <tr onClick={() => setOpen(open === s.id ? null : s.id)} className="cursor-pointer border-t hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold">#{s.code}</td>
                  <td className="p-3"><StatusBadge s={s.status} /></td>
                  <td className="max-w-xs truncate p-3">{s.pickup_address} → {s.dropoff_address}</td>
                  <td className="p-3 text-end tabular-nums">{money(s.price)}</td>
                  <td className="p-3 text-end tabular-nums text-brand-700">{money(s.platform_fee)}</td>
                  <td className="p-3 text-slate-500">{new Date(s.created_at).toLocaleString(lang === "en" ? "en-GB" : lang)}</td>
                </tr>
                {open === s.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={6} className="p-4">
                      <div className="grid gap-2 text-xs md:grid-cols-3">
                        <div>{t("recipient")}: <b>{s.recipient_name}</b> <span dir="ltr">{s.recipient_phone}</span></div>
                        <div>{t("distance")}: {s.distance_km} {t("km")} · {t(s.package_size)} · {t(s.vehicle)}</div>
                        <div>COD: {money(s.cod_amount)} · OTP: <span className="font-mono">{s.delivery_otp}</span></div>
                        <div>{t("radius")}: {s.dispatch_radius_km} · {t("round")}: {s.dispatch_round}</div>
                        <div>{t("courier_gets")}: {money(s.courier_earning)}</div>
                        {s.cancel_reason && <div className="text-red-600">{t("cancel_reason")}: {s.cancel_reason}</div>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={`/track/${s.tracking_token}`} target="_blank" className="btn-ghost"><ExternalLink className="h-4 w-4" />{t("share_tracking")}</a>
                        {s.status === "searching" && <button className="btn-ghost" onClick={() => act("expand_dispatch", { p_id: s.id })}>{t("dispatch")} +{t("radius")}</button>}
                        {!["delivered", "cancelled", "expired"].includes(s.status) && <button className="btn-danger" onClick={() => act("cancel_shipment", { p_id: s.id, p_reason: "admin" })}>{t("cancel_shipment")}</button>}
                        {s.proof_photo_url && <a href={s.proof_photo_url} target="_blank" className="btn-ghost">📷 {t("proof_photo")}</a>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

export default function AdminShipments() { return <Suspense><AdminShipmentsInner /></Suspense>; }
