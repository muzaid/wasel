"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Avatar, Spinner } from "@/components/ui";
import { PageHead, StatusPill, fmtDate } from "@/components/support";
import { useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { useTs, supportErr, SKey } from "@/lib/i18n-support";
import { supabase, T } from "@/lib/supabase";
import { money } from "@/lib/geo";
import type { Refund } from "@/lib/types";

type Row = Refund & {
  requester: { full_name: string; avatar_url: string | null; phone: string | null } | null;
  shipment: { id: string; code: string; price: number; discount_amount: number; status: string; pickup_address: string; dropoff_address: string; delivered_at: string | null;
    business: { business_name: string } | null } | null;
};

/** Admin: approve or reject refund requests. */
export default function AdminRefunds() {
  const ok = useRequireRole("admin");
  const { t, lang } = useI18n();
  const { ts } = useTs();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "">("pending");
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<"card" | "credit">("card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => supabase.from("refunds").select(`*, requester:${T("profiles")}!requester_id(full_name, avatar_url, phone),
    shipment:${T("shipments")}(id, code, price, discount_amount, status, pickup_address, dropoff_address, delivered_at, business:${T("businesses")}!business_id(business_name))`)
    .order("created_at", { ascending: false }).limit(200).then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  useEffect(() => { if (ok) load(); }, [ok]);

  const list = useMemo(() => (rows ?? []).filter((r) => !filter || r.status === filter), [rows, filter]);
  const cur = rows?.find((r) => r.id === sel) ?? null;
  useEffect(() => { if (cur) { setMethod(cur.method); setNote(cur.admin_note ?? ""); setErr(""); } }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ok || !rows) return <AppShell wide><Spinner /></AppShell>;
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const decide = async (approve: boolean) => {
    if (!cur) return;
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("decide_refund", { p_id: cur.id, p_approve: approve, p_note: note, p_method: method });
    setBusy(false);
    if (error) setErr(ts(supportErr(error.message))); else load();
  };

  return (
    <AppShell wide>
      <PageHead title={ts("refund_requests")} sub={ts("refund_ledger_note")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {([["pending", "rs_pending"], ["approved", "rs_approved"], ["rejected", "rs_rejected"], ["", "all"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`chip px-3.5 py-2 text-sm ${filter === k ? "bg-ink-900 text-white" : "bg-white shadow-sm"}`}>
            {ts(l as SKey)}{k ? ` · ${count(k)}` : ""}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="card overflow-hidden self-start">
          {list.length === 0 && <div className="p-6 text-center text-ink-500">{ts("no_refunds")}</div>}
          {list.map((r) => (
            <button type="button" key={r.id} onClick={() => setSel(r.id)}
              className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-start last:border-0 hover:bg-mint ${sel === r.id ? "bg-[#F1FAF6]" : ""}`}>
              <Avatar src={r.requester?.avatar_url} name={r.requester?.full_name} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{r.shipment?.business?.business_name || r.requester?.full_name} <span className="font-normal text-ink-500">· #{r.shipment?.code}</span></div>
                <div className="truncate text-sm text-ink-500">{ts(`r_${r.reason}` as SKey)} · {fmtDate(r.created_at, lang)}{r.photo_url ? " · 📷" : ""}</div>
              </div>
              <div className="text-end"><div className="font-extrabold tabular-nums">{money(r.amount)}</div><StatusPill s={r.status} /></div>
            </button>
          ))}
        </div>

        <div className="card self-start p-5">
          {!cur ? <div className="py-10 text-center text-ink-500">{ts("pick_one")}</div> : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Link href="/admin/shipments" className="text-lg font-extrabold">#{cur.shipment?.code}</Link><StatusPill s={cur.status} />
              </div>
              <div className="text-sm text-ink-700">{cur.requester?.full_name} <span dir="ltr" className="text-ink-500">{cur.requester?.phone}</span></div>
              {cur.photo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <a href={cur.photo_url} target="_blank" rel="noreferrer"><img src={cur.photo_url} alt={ts("customer_photo")} className="h-44 w-full rounded-2xl object-cover" /></a>
                : <div className="grid h-20 place-items-center rounded-2xl bg-mint text-sm text-ink-500">{ts("no_photo")}</div>}
              <div className="rounded-2xl bg-mint p-3 text-sm"><b>{ts(`r_${cur.reason}` as SKey)}</b>{cur.details ? <p className="mt-1 whitespace-pre-wrap text-ink-700">“{cur.details}”</p> : null}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-ink-100 p-3"><div className="text-xs text-ink-500">{ts("amount")}</div><b>{money(cur.amount)}</b> / {money(Number(cur.shipment?.price ?? 0) - Number(cur.shipment?.discount_amount ?? 0))}</div>
                <div className="rounded-2xl bg-ink-100 p-3"><div className="text-xs text-ink-500">{ts("delivery")}</div><b>{cur.shipment ? t(`st_${cur.shipment.status}` as TKey) : "—"}</b></div>
              </div>
              <div className="truncate text-xs text-ink-500">{cur.shipment?.pickup_address} → {cur.shipment?.dropoff_address}</div>
              {cur.status === "pending" ? (
                <>
                  <div className="flex rounded-2xl bg-ink-100 p-1">
                    {(["card", "credit"] as const).map((m) => (
                      <button type="button" key={m} onClick={() => setMethod(m)} className={`flex-1 rounded-xl py-2 text-sm font-bold ${method === m ? "bg-white shadow" : "text-ink-500"}`}>{ts(m === "card" ? "to_card" : "to_credit")}</button>
                    ))}
                  </div>
                  <textarea className="input" rows={2} placeholder={ts("admin_note")} value={note} onChange={(e) => setNote(e.target.value)} />
                  {err && <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
                  <div className="grid grid-cols-[1fr_1.4fr] gap-2">
                    <button type="button" disabled={busy} onClick={() => decide(false)} className="btn bg-ink-100 py-3.5 text-ink-900">{ts("reject")}</button>
                    <button type="button" disabled={busy} onClick={() => decide(true)} className="btn-primary py-3.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `${ts("approve")} ${money(cur.amount)}`}</button>
                  </div>
                </>
              ) : cur.admin_note && <div className="rounded-2xl bg-brand-50 p-3 text-sm"><b>{ts("admin_answer")}:</b> {cur.admin_note}</div>}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
