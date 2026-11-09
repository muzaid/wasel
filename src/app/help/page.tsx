"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, HandCoins, Mail, MessageCircle, Phone, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import TicketForm from "@/components/TicketForm";
import { PageHead, StatusPill, fmtDate } from "@/components/support";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTs, SKey } from "@/lib/i18n-support";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/geo";
import { SUPPORT } from "@/lib/support";
import type { Refund, Ticket } from "@/lib/types";

const FAQ = [1, 2, 3, 4, 5, 6] as const;
const FAQ_TOPIC: Record<number, string> = { 1: "delivery", 2: "refund", 3: "coupon", 4: "payment", 5: "delivery", 6: "courier" };
const FILTERS = ["delivery", "refund", "coupon", "payment", "courier"] as const;

/** Help desk: search the common questions, see your requests, write to us. */
export default function HelpPage() {
  const { session } = useAuth();
  const { lang } = useI18n();
  const { ts } = useTs();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [writing, setWriting] = useState(false);
  const [topic, setTopic] = useState("other");
  const [shipment, setShipment] = useState<string | null>(null);
  const uid = session?.user.id;

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("new")) { setTopic(p.get("new")!); setWriting(true); }
    if (p.get("shipment")) setShipment(p.get("shipment"));
  }, []);
  const load = () => {
    if (!uid) return;
    supabase.from("tickets").select("*").eq("user_id", uid).order("updated_at", { ascending: false }).limit(20).then(({ data }) => setTickets((data as Ticket[]) ?? []));
    supabase.from("refunds").select("*").eq("requester_id", uid).eq("status", "pending").then(({ data }) => setRefunds((data as Refund[]) ?? []));
  };
  useEffect(load, [uid]);

  const faq = useMemo(() => FAQ.filter((n) => (!filter || FAQ_TOPIC[n] === filter) &&
    (!q || (ts(`faq_q${n}` as SKey) + " " + ts(`faq_a${n}` as SKey)).toLowerCase().includes(q.toLowerCase()))), [q, filter, ts]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHead title={ts("how_help")} sub={ts("reply_fast")} back={session ? "/account" : "/"} />
        <label className="flex items-center gap-3 rounded-2xl border-2 border-[#E6EEEB] bg-white px-4 py-3">
          <Search className="h-5 w-5 text-ink-500" /><input className="flex-1 bg-transparent outline-none" placeholder={ts("search_help")} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(filter === f ? null : f)}
              className={`chip px-3 py-1.5 text-[13px] ${filter === f ? "bg-ink-900 text-white" : "bg-white text-ink-700 shadow-sm"}`}>{ts(`tp_${f}` as SKey)}</button>
          ))}
        </div>

        {session && (tickets.length > 0 || refunds.length > 0) && (
          <section>
            <h2 className="label uppercase">{ts("your_tickets")}</h2>
            <div className="card overflow-hidden">
              {refunds.map((r) => (
                <Link key={"r" + r.id} href="/refunds" className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-mint">
                  <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-peach-50 text-[#B4442D]"><HandCoins className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><div className="font-bold">{ts("tp_refund")} · {money(r.amount)}</div><div className="truncate text-sm text-ink-500">{ts(`r_${r.reason}` as SKey)}</div></div>
                  <StatusPill s={r.status} />
                </Link>
              ))}
              {tickets.map((t) => (
                <Link key={t.id} href={`/help/${t.id}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-mint">
                  <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-brand-50 text-brand-700"><MessageCircle className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><div className="truncate font-bold">{t.subject}</div><div className="truncate text-sm text-ink-500">{ts(`tp_${t.topic}` as SKey)} · {fmtDate(t.updated_at, lang)}</div></div>
                  <StatusPill s={t.status} />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="label uppercase">{ts("common_questions")}</h2>
          <div className="card overflow-hidden">
            {faq.map((n) => (
              <div key={n} className="border-b border-slate-100 last:border-0">
                <button type="button" onClick={() => setOpen(open === n ? null : n)} aria-expanded={open === n}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-start font-semibold hover:bg-mint">
                  <span className="flex-1">{ts(`faq_q${n}` as SKey)}</span><ChevronDown className={`h-4 w-4 text-slate-400 transition ${open === n ? "rotate-180" : ""}`} />
                </button>
                {open === n && <p className="px-4 pb-4 text-[15px] leading-relaxed text-ink-700">{ts(`faq_a${n}` as SKey)}</p>}
              </div>
            ))}
            {faq.length === 0 && <div className="p-4 text-sm text-ink-500">—</div>}
          </div>
        </section>

        <section className="card p-5">
          {!writing
            ? <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
                <button type="button" onClick={() => setWriting(true)} className="btn-primary py-3.5"><MessageCircle className="h-5 w-5" />{ts("new_request")}</button>
                <a href={`https://wa.me/${SUPPORT.whatsapp}`} target="_blank" rel="noreferrer" className="btn bg-[#25D366] text-white" aria-label={ts("whatsapp")}><Phone className="h-5 w-5" /></a>
                <a href={`mailto:${SUPPORT.email}`} className="btn bg-ink-100 text-ink-900" aria-label={ts("email_us")}><Mail className="h-5 w-5" /></a>
              </div>
            : <>
                <h2 className="mb-3 text-lg font-extrabold">{ts("new_request")}</h2>
                <TicketForm key={topic} defaultTopic={topic} shipmentId={shipment} onSent={() => { load(); }} />
              </>}
        </section>
      </div>
    </AppShell>
  );
}
