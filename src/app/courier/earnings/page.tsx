"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/geo";

interface Bal { earnings: number; fees_owed: number; cod_held: number; payouts: number; today: number; week: number }
interface Row { id: number; kind: string; amount: number; created_at: string; shipment_id: string | null }

const KIND: Record<string, TKey> = { courier_earning: "earnings", platform_fee: "platform_fee", cod_collected: "cod_held", cod_settled: "settle_cod", payout: "payouts", adjustment: "amount" };

export default function Earnings() {
  const ok = useRequireRole("courier");
  const { session } = useAuth();
  const { t, lang } = useI18n();
  const [bal, setBal] = useState<Bal | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!session) return;
    supabase.rpc("courier_balance").then(({ data }) => setBal(data as Bal));
    supabase.from("ledger").select("*").eq("courier_id", session.user.id).order("created_at", { ascending: false }).limit(200).then(({ data }) => setRows((data as Row[]) ?? []));
  }, [session]);

  if (!ok || !bal) return <AppShell><Spinner /></AppShell>;
  // courier keeps the full price from the business (cash/app) → net owed to platform = fees − payouts handled by admin
  const net = Number(bal.earnings) - Number(bal.payouts);

  return (
    <AppShell>
      <h1 className="mb-5 text-2xl font-extrabold">{t("earnings")}</h1>
      <div className="mb-6 rounded-3xl bg-ink-900 p-6 text-white">
        <div className="text-sm text-slate-400">{t("week")}</div>
        <div className="text-5xl font-extrabold tabular-nums">{money(bal.week)}</div>
        <div className="mt-1 text-sm text-brand-400">{t("today")}: {money(bal.today)}</div>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="stat"><div className="stat-label">{t("earnings")}</div><div className="stat-value text-brand-600">{money(bal.earnings)}</div></div>
        <div className="stat"><div className="stat-label">{t("fees_owed")}</div><div className="stat-value">{money(bal.fees_owed)}</div></div>
        <div className="stat"><div className="stat-label">{t("cod_held")}</div><div className="stat-value text-amber-600">{money(bal.cod_held)}</div></div>
        <div className="stat"><div className="stat-label">{t("net")}</div><div className="stat-value">{money(net)}</div></div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-start">{t("date")}</th><th className="p-3 text-start">{t("details")}</th><th className="p-3 text-end">{t("amount")}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 text-slate-500">{new Date(r.created_at).toLocaleString(lang === "en" ? "en-GB" : lang)}</td>
                <td className="p-3">{t(KIND[r.kind] ?? "amount")}</td>
                <td className={`p-3 text-end font-semibold tabular-nums ${r.kind === "courier_earning" ? "text-brand-600" : r.kind === "platform_fee" ? "text-red-500" : ""}`}>
                  {r.kind === "platform_fee" ? "−" : ""}{money(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
