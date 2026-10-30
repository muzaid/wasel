"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Spinner, vehicleEmoji } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import type { Courier, Profile } from "@/lib/types";

type Row = Courier & { profiles: Profile };

export default function AdminCouriers() {
  const ok = useRequireRole("admin");
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  const load = () => supabase.from("couriers").select("*, profiles(*)").then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  useEffect(() => { if (ok) load(); }, [ok]);
  if (!ok || !rows) return <AppShell wide><Spinner /></AppShell>;

  const setV = async (id: string, v: Courier["verification"]) => {
    await supabase.from("couriers").update({ verification: v, ...(v !== "approved" ? { is_online: false } : {}) }).eq("id", id);
    await supabase.from("notifications").insert({ user_id: id, title: `verification_${v}`, body: t(v), link: "/courier/profile" });
    load();
  };
  const block = async (id: string, b: boolean) => { await supabase.from("profiles").update({ is_blocked: b }).eq("id", id); load(); };
  const list = rows.filter((r) => r.verification === tab);
  const fresh = (r: Row) => r.is_online && r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < 180000;

  return (
    <AppShell wide>
      <h1 className="mb-4 text-2xl font-extrabold">{t("couriers")}</h1>
      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
        {(["pending", "approved", "rejected"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === k ? "bg-white shadow" : "text-slate-500"}`}>
            {t(k)} ({rows.filter((r) => r.verification === k).length})
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center gap-3">
              {r.profiles?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.profiles.avatar_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-2xl">{vehicleEmoji(r.vehicle)}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-bold">{r.profiles?.full_name}{fresh(r) && <span className="h-2 w-2 rounded-full bg-brand-500" />}</div>
                <div className="text-xs text-slate-500" dir="ltr">{r.profiles?.phone}</div>
              </div>
              <div className="text-end text-xs"><div>★ {Number(r.rating_avg).toFixed(1)}</div><div className="text-slate-400">{r.total_deliveries}</div></div>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-2 text-xs">{t(r.vehicle)} · {r.vehicle_model} · {r.vehicle_color} · <span dir="ltr" className="font-mono">{r.plate_number}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[["id_doc", r.id_doc_url], ["license_doc", r.license_doc_url]].map(([k, u]) => u ? (
                <a key={k} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={k!} className="h-20 w-full object-cover" />
                </a>
              ) : <div key={k} className="grid h-20 place-items-center rounded-lg border border-dashed text-[11px] text-slate-400">{t(k as "id_doc")} —</div>)}
            </div>
            <div className="mt-3 flex gap-2">
              {r.verification !== "approved" && <button onClick={() => setV(r.id, "approved")} className="btn-primary flex-1">{t("approve")}</button>}
              {r.verification !== "rejected" && <button onClick={() => setV(r.id, "rejected")} className="btn-danger flex-1">{t("reject")}</button>}
              <button onClick={() => block(r.id, !r.profiles?.is_blocked)} className="btn-ghost">{r.profiles?.is_blocked ? t("unblock") : t("block")}</button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
