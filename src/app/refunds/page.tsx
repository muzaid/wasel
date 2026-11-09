"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, HandCoins, Loader2, Package } from "lucide-react";
import AppShell from "@/components/AppShell";
import PhotoUpload from "@/components/PhotoUpload";
import { Empty, Spinner } from "@/components/ui";
import { PageHead, StatusPill, fmtDate } from "@/components/support";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTs, supportErr, SKey } from "@/lib/i18n-support";
import { supabase, T } from "@/lib/supabase";
import { money } from "@/lib/geo";
import { REFUND_REASONS, REFUNDABLE } from "@/lib/support";
import type { Refund, RefundReason, Shipment } from "@/lib/types";

type Row = Refund & { shipment: Pick<Shipment, "id" | "code" | "pickup_address" | "dropoff_address" | "business_id"> | null };

/** "My refund requests" + the request form when opened from a delivery (?shipment=ID). */
export default function RefundsPage() {
  const { session, activeRole, loading } = useAuth();
  const { lang } = useI18n();
  const { ts } = useTs();
  const router = useRouter();
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sent, setSent] = useState(false);
  const uid = session?.user.id;

  useEffect(() => { setShipmentId(new URLSearchParams(window.location.search).get("shipment")); }, []);
  useEffect(() => { if (!loading && !session) router.replace("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search)); }, [loading, session, router]);
  const load = () => supabase.from("refunds").select(`*, shipment:${T("shipments")}(id, code, pickup_address, dropoff_address, business_id)`)
    .order("created_at", { ascending: false }).then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  useEffect(() => { if (uid) load(); }, [uid]);

  if (!session || !rows) return <AppShell><Spinner /></AppShell>;
  const backHref = activeRole === "business" ? "/business" : "/account";
  const shipLink = (r: Row) => `/${r.shipment?.business_id ? "business" : "customer"}/shipments/${r.shipment_id}`;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        {shipmentId && !sent
          ? <RefundForm shipmentId={shipmentId} onDone={() => { setSent(true); load(); }} />
          : <>
            <PageHead title={ts("my_refunds")} sub={ts("refund_from_delivery")} back={backHref} />
            {sent && <div className="mb-4 rounded-2xl bg-brand-50 p-4 font-semibold text-brand-700">✓ {ts("refund_sent")}</div>}
            {rows.length === 0 && <Empty icon={<HandCoins className="h-6 w-6" />} title={ts("no_refunds")} />}
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-peach-50 text-[#B4442D]"><HandCoins className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <Link href={shipLink(r)} className="font-bold hover:underline">#{r.shipment?.code} · {ts(`r_${r.reason}` as SKey)}</Link>
                      <div className="truncate text-sm text-ink-500">{fmtDate(r.created_at, lang)} · {ts(r.method === "credit" ? "to_credit" : "to_card")}</div>
                    </div>
                    <div className="text-end"><div className="text-lg font-extrabold tabular-nums">{money(r.amount)}</div><StatusPill s={r.status} /></div>
                  </div>
                  {r.admin_note && <div className="mt-3 rounded-2xl bg-mint p-3 text-sm"><b>{ts("admin_answer")}:</b> {r.admin_note}</div>}
                </div>
              ))}
            </div>
          </>}
      </div>
    </AppShell>
  );
}

function RefundForm({ shipmentId, onDone }: { shipmentId: string; onDone: () => void }) {
  const { session } = useAuth();
  const { t, lang } = useI18n();
  const { ts } = useTs();
  const [sh, setSh] = useState<Shipment | null>(null);
  const [max, setMax] = useState(0);
  const [reason, setReason] = useState<RefundReason>("damaged");
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"card" | "credit">("card");
  const [photo, setPhoto] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("shipments").select("*").eq("id", shipmentId).single().then(async ({ data }) => {
      const s = data as Shipment | null;
      setSh(s);
      if (!s) return;
      const { data: rs } = await supabase.from("refunds").select("amount,status").eq("shipment_id", shipmentId);
      const taken = (rs ?? []).filter((r) => r.status !== "rejected").reduce((a, r) => a + Number(r.amount), 0);
      setMax(Math.max(0, Number(s.price) - Number(s.discount_amount ?? 0) - taken));
    });
  }, [shipmentId]);

  if (!sh) return <Spinner />;
  const allowed = REFUNDABLE.includes(sh.status) && max > 0;
  const value = full ? max : Math.min(max, Number(amount) || 0);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("request_refund", { p_shipment: sh.id, p_reason: reason, p_details: details, p_amount: value, p_photo: photo, p_method: method });
    setBusy(false);
    if (error) setErr(ts(supportErr(error.message))); else onDone();
  };

  return (
    <form onSubmit={send} className="space-y-4">
      <PageHead title={ts("ask_refund")} sub={`#${sh.code} · ${new Date(sh.created_at).toLocaleDateString(lang === "en" ? "en-GB" : lang)}`}
        back={`/${sh.business_id ? "business" : "customer"}/shipments/${sh.id}`} />
      <div className="card flex items-center gap-3 p-4">
        <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-brand-50 text-brand-700"><Package className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><div className="truncate font-bold">{sh.pickup_address} → {sh.dropoff_address}</div><div className="text-sm text-ink-500">{t(`st_${sh.status}` as never)}</div></div>
        <div className="text-lg font-extrabold tabular-nums">{money(Number(sh.price) - Number(sh.discount_amount ?? 0))}</div>
      </div>
      {!allowed && <div className="rounded-2xl bg-sun-50 p-4 text-sm font-semibold text-sun-700">{ts(max <= 0 && REFUNDABLE.includes(sh.status) ? "refund_pending" : "refund_not_allowed")}</div>}
      {allowed && <>
        <div>
          <div className="label uppercase">{ts("what_went_wrong")}</div>
          <div className="space-y-2" role="radiogroup">
            {REFUND_REASONS.map((r) => (
              <button type="button" key={r} role="radio" aria-checked={reason === r} onClick={() => setReason(r)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-start font-semibold transition ${reason === r ? "border-brand-600 bg-[#F1FAF6]" : "border-[#E6EEEB] bg-white"}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${reason === r ? "border-brand-600" : "border-slate-300"}`}>{reason === r && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}</span>
                {ts(`r_${r}` as SKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">{ts("amount")} · {ts("up_to")} {money(max)}</div>
            <div className="flex rounded-2xl border-2 border-[#E6EEEB] bg-white p-1">
              <button type="button" onClick={() => setFull(true)} className={`flex-1 rounded-xl py-2 text-sm font-bold ${full ? "bg-ink-900 text-white" : "text-ink-500"}`}>{ts("full_amount")} {money(max)}</button>
              <button type="button" onClick={() => setFull(false)} className={`flex-1 rounded-xl py-2 text-sm font-bold ${!full ? "bg-ink-900 text-white" : "text-ink-500"}`}>{ts("part_amount")}</button>
            </div>
            {!full && <input className="input mt-2" type="number" min="1" step="0.5" max={max} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₪" />}
          </div>
          <div>
            <div className="label">{ts("refund_to")}</div>
            <div className="flex rounded-2xl border-2 border-[#E6EEEB] bg-white p-1">
              {(["card", "credit"] as const).map((m) => (
                <button type="button" key={m} onClick={() => setMethod(m)} className={`flex-1 rounded-xl py-2 text-sm font-bold ${method === m ? "bg-ink-900 text-white" : "text-ink-500"}`}>{ts(m === "card" ? "to_card" : "to_credit")}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <PhotoUpload userId={session!.user.id} url={photo} folder="refunds" onUploaded={setPhoto} shape="square" size={84}
            placeholder={<span className="text-2xl">📷</span>} label={ts("add_photo")} />
        </div>
        <textarea className="input" rows={3} placeholder={ts("tell_more")} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />
        <div className="flex items-center gap-2 rounded-2xl bg-sun-50 p-3 text-sm font-semibold text-sun-700"><Clock className="h-4 w-4 shrink-0" />{ts("refund_review_note")}</div>
        {err && <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-primary w-full py-4 text-base" disabled={busy || value <= 0}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : `${ts("send_request")} · ${money(value)}`}
        </button>
      </>}
    </form>
  );
}
