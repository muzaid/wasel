"use client";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import AppShell from "@/components/AppShell";
import TicketForm from "@/components/TicketForm";
import { PageHead } from "@/components/support";
import { useTs } from "@/lib/i18n-support";
import { SUPPORT } from "@/lib/support";

/** Contact us — works for guests too (they leave an email or phone). */
export default function ContactPage() {
  const { ts } = useTs();
  const rows = [
    [<Phone key="p" className="h-5 w-5" />, ts("call_us"), SUPPORT.phone, `tel:${SUPPORT.phone}`],
    [<MessageCircle key="w" className="h-5 w-5" />, ts("whatsapp"), SUPPORT.whatsapp.replace(/^972/, "0"), `https://wa.me/${SUPPORT.whatsapp}`],
    [<Mail key="m" className="h-5 w-5" />, ts("email_us"), SUPPORT.email, `mailto:${SUPPORT.email}`],
    [<MapPin key="a" className="h-5 w-5" />, ts("office"), SUPPORT.address, `https://www.openstreetmap.org/search?query=${encodeURIComponent(SUPPORT.address)}`],
  ] as const;
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHead title={ts("contact_us")} sub={<span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{ts("hours")}</span>} back="/" />
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-extrabold">{ts("contact_title")}</h2>
          <TicketForm topics={["other", "delivery", "business", "partnership", "press", "complaint"]} />
        </div>
        <div className="card overflow-hidden">
          {rows.map(([icon, label, value, href]) => (
            <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
              className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0 hover:bg-mint">
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-brand-50 text-brand-700">{icon}</span>
              <div className="flex-1"><div className="text-xs font-semibold text-ink-500">{label}</div><div className="font-semibold" dir="ltr">{value}</div></div>
            </a>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
