"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { Spinner } from "@/components/ui";
import { PageHead, StatusPill } from "@/components/support";
import { useI18n } from "@/lib/i18n";
import { useTs, supportErr, SKey } from "@/lib/i18n-support";
import { supabase, T } from "@/lib/supabase";
import type { Ticket, TicketMessage } from "@/lib/types";

/** One help-desk conversation. `staff` = admin view. */
export default function TicketThread({ id, staff = false, back }: { id: number; staff?: boolean; back: string }) {
  const { lang } = useI18n();
  const { ts } = useTs();
  const [tk, setTk] = useState<(Ticket & { shipment: { code: string; business_id: string | null } | null }) | null>(null);
  const [msgs, setMsgs] = useState<TicketMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("tickets").select(`*, shipment:${T("shipments")}(code, business_id)`).eq("id", id).maybeSingle(),
      supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at"),
    ]);
    setTk(t as never); setMsgs((m as TicketMessage[]) ?? []);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("ticket-" + id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${id}` }, load).subscribe();
    const poll = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  if (!tk) return <Spinner />;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("ticket_reply", { p_ticket: id, p_body: body });
    setBusy(false);
    if (error) setErr(ts(supportErr(error.message))); else { setBody(""); load(); }
  };
  const setStatus = async (s: string) => { await supabase.rpc("ticket_status", { p_ticket: id, p_status: s }); load(); };
  const time = (d: string) => new Date(d).toLocaleString(lang === "en" ? "en-GB" : lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const shipHref = tk.shipment_id && (staff ? "/admin/shipments" : `/${tk.shipment?.business_id ? "business" : "customer"}/shipments/${tk.shipment_id}`);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={tk.subject} back={back}
        sub={<span className="flex flex-wrap items-center gap-2"><StatusPill s={tk.status} /><span>{ts(`tp_${tk.topic}` as SKey)} · #{tk.id}</span>
          {shipHref && <Link href={shipHref} className="font-semibold text-brand-700">{ts("about_delivery")} #{tk.shipment?.code}</Link>}</span>} />
      {staff && (
        <div className="card mb-4 grid gap-1 p-4 text-sm sm:grid-cols-3">
          <div><b>{tk.name || "—"}</b> {!tk.user_id && <span className="chip bg-ink-100">{ts("from_guest")}</span>}</div>
          <div dir="ltr" className="sm:text-center">{tk.email || ""}</div>
          <div dir="ltr" className="sm:text-end">{tk.phone || ""}</div>
        </div>
      )}
      <div className="space-y-3">
        {msgs.map((m) => {
          const mine = staff ? m.is_staff : !m.is_staff;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-3xl px-4 py-3 ${mine ? "rounded-ee-md bg-brand-600 text-white" : "rounded-es-md bg-white shadow-sm"}`}>
                <div className={`mb-1 text-xs font-bold ${mine ? "text-white/80" : "text-ink-500"}`}>{m.is_staff ? ts("support_team") : staff ? (tk.name || ts("from_guest")) : ts("you")} · {time(m.created_at)}</div>
                <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {(staff || tk.user_id) && (
        <form onSubmit={send} className="mt-5 space-y-2">
          <textarea className="input" rows={3} placeholder={ts("write_reply")} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
          {err && <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" disabled={busy || !body.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 rtl:rotate-180" />{ts("reply")}</>}</button>
            {tk.status !== "solved"
              ? <button type="button" onClick={() => setStatus("solved")} className="btn-ghost">✓ {ts("mark_solved")}</button>
              : <button type="button" onClick={() => setStatus("open")} className="btn-ghost">{ts("reopen")}</button>}
          </div>
          {staff && !tk.user_id && tk.email && <p className="text-xs text-ink-500">Guest: answer by email <a className="font-semibold text-brand-700" href={`mailto:${tk.email}?subject=${encodeURIComponent("Re: " + tk.subject)}`}>{tk.email}</a></p>}
        </form>
      )}
    </div>
  );
}
