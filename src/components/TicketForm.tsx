"use client";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTs, supportErr, SKey } from "@/lib/i18n-support";
import { supabase } from "@/lib/supabase";
import { TOPICS } from "@/lib/support";

/** Help-desk request / contact-us form. Guests leave a name and an email or phone. */
export default function TicketForm({ topics = TOPICS as unknown as string[], defaultTopic = "other", shipmentId, onSent }: {
  topics?: string[]; defaultTopic?: string; shipmentId?: string | null; onSent?: (id: number) => void;
}) {
  const { session, activeRole } = useAuth();
  const { ts } = useTs();
  const [topic, setTopic] = useState(topics.includes(defaultTopic) ? defaultTopic : topics[0]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const isEmail = contact.includes("@");
    const { data, error } = await supabase.rpc("open_ticket", {
      p_topic: topic, p_subject: subject || ts(`tp_${topic}` as SKey), p_body: body,
      p_name: session ? null : name, p_email: session ? null : isEmail ? contact : null, p_phone: session ? null : isEmail ? null : contact,
      p_shipment: shipmentId ?? null, p_role: session ? activeRole : null,
    });
    setBusy(false);
    if (error) { setErr(ts(supportErr(error.message))); return; }
    setDone(true); setSubject(""); setBody("");
    onSent?.(data as number);
  };

  if (done && !session) return <div className="rounded-2xl bg-brand-50 p-4 font-semibold text-brand-700">✓ {ts("sent_thanks")}</div>;
  return (
    <form onSubmit={send} className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {topics.map((k) => (
          <button type="button" key={k} onClick={() => setTopic(k)}
            className={`chip px-3 py-1.5 text-[13px] ${topic === k ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700"}`}>{ts(`tp_${k}` as SKey)}</button>
        ))}
      </div>
      {!session && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" placeholder={ts("your_name")} value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder={ts("email_or_phone")} value={contact} onChange={(e) => setContact(e.target.value)} required dir="ltr" />
        </div>
      )}
      <input className="input" placeholder={ts("subject")} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
      <textarea className="input" rows={4} placeholder={ts("message")} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={4000} />
      {err && <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {done && <div className="rounded-2xl bg-brand-50 p-3 text-sm font-semibold text-brand-700">✓ {ts("sent_thanks")}</div>}
      <button className="btn-dark w-full py-3.5" disabled={busy || !body.trim()}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4 rtl:rotate-180" />{ts("send_message")}</>}</button>
    </form>
  );
}
