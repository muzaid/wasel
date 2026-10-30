"use client";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/geo";

interface L { id: number; kind: string; amount: number; courier_id: string | null; business_id: string | null; shipment_id: string | null; created_at: string; note: string | null }

export default function Finance() {
  const ok = useRequireRole("admin");
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<L[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [days, setDays] = useState(30);

  const load = () => {
    supabase.from("ledger").select("*").gte("created_at", new Date(Date.now() - days * 864e5).toISOString()).order("created_at", { ascending: false }).limit(5000)
      .then(({ data }) => setRows((data as L[]) ?? []));
    supabase.from("profiles").select("id, full_name").eq("role", "courier").then(({ data }) => setNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]))));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (ok) load(); }, [ok, days]);

  const perCourier = useMemo(() => {
    const m: Record<string, { fees: number; cod: number; earn: number; payouts: number; n: number }> = {};
    (rows ?? []).forEach((r) => {
      if (!r.courier_id) return;
      const x = (m[r.courier_id] ??= { fees: 0, cod: 0, earn: 0, payouts: 0, n: 0 });
      const a = Number(r.amount);
      if (r.kind === "platform_fee") { x.fees += a; x.n++; }
      if (r.kind === "courier_earning") x.earn += a;
      if (r.kind === "cod_collected") x.cod += a;
      if (r.kind === "cod_settled") x.cod -= a;
      if (r.kind === "payout") x.payouts += a;
    });
    return Object.entries(m).sort((a, b) => b[1].fees - a[1].fees);
  }, [rows]);

  if (!ok || !rows) return <AppShell wide><Spinner /></AppShell>;
  const revenue = rows.filter((r) => r.kind === "platform_fee").reduce((a, r) => a + Number(r.amount), 0);
  const cod = perCourier.reduce((a, [, v]) => a + v.cod, 0);

  const record = async (courier_id: string, kind: "cod_settled" | "payout") => {
    const v = prompt(t("amount") + " ₪");
    if (!v || isNaN(Number(v))) return;
    const { error } = await supabase.from("ledger").insert({ courier_id, kind, amount: Number(v), note: "admin" });
    if (error) alert(error.message); else load();
  };
  const exportCsv = () => {
    const csv = "﻿date,kind,amount,courier,shipment\n" + rows.map((r) => [r.created_at, r.kind, r.amount, names[r.courier_id ?? ""] ?? "", r.shipment_id ?? ""].join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "wasel-ledger.csv"; a.click();
  };

  return (
    <AppShell wide>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">{t("finance")}</h1>
        <select className="input ms-auto w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[1, 7, 30, 90, 365].map((d) => <option key={d} value={d}>{d}d</option>)}
        </select>
        <button onClick={exportCsv} className="btn-ghost"><Download className="h-4 w-4" />CSV</button>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="stat bg-brand-600 text-white"><div className="text-xs text-brand-100">{t("revenue")}</div><div className="stat-value">{money(revenue)}</div></div>
        <div className="stat"><div className="stat-label">{t("delivered_count")}</div><div className="stat-value">{rows.filter((r) => r.kind === "platform_fee").length}</div></div>
        <div className="stat"><div className="stat-label">{t("cod_held")}</div><div className="stat-value text-amber-600">{money(cod)}</div></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="p-3 text-start">{t("courier")}</th><th className="p-3 text-end">{t("deliveries")}</th><th className="p-3 text-end">{t("platform_fee")}</th><th className="p-3 text-end">{t("earnings")}</th><th className="p-3 text-end">{t("cod_held")}</th><th className="p-3 text-end">{t("payouts")}</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {perCourier.map(([id, v]) => (
              <tr key={id} className="border-t">
                <td className="p-3 font-semibold">{names[id] ?? id.slice(0, 8)}</td>
                <td className="p-3 text-end">{v.n}</td>
                <td className="p-3 text-end font-semibold text-brand-700">{money(v.fees)}</td>
                <td className="p-3 text-end">{money(v.earn)}</td>
                <td className="p-3 text-end text-amber-700">{money(v.cod)}</td>
                <td className="p-3 text-end">{money(v.payouts)}</td>
                <td className="space-x-1 p-3 text-end rtl:space-x-reverse">
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => record(id, "cod_settled")}>{t("settle_cod")}</button>
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => record(id, "payout")}>{t("record_payout")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-slate-400">{rows.length} · {new Date().toLocaleDateString(lang === "en" ? "en-GB" : lang)}</div>
    </AppShell>
  );
}
