"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTs, SKey } from "@/lib/i18n-support";

export const TONES = {
  green: "bg-brand-50 text-brand-700", sun: "bg-sun-50 text-sun-700", sky: "bg-sky2-50 text-sky2-700",
  peach: "bg-peach-50 text-[#B4442D]", violet: "bg-[#EDE4FA] text-[#5B3A99]", grey: "bg-ink-100 text-ink-700",
} as const;
export type Tone = keyof typeof TONES;

/** Square shortcut on the account page. */
export function Tile({ href, icon, label, tone = "green", badge, onClick }: { href?: string; icon: React.ReactNode; label: string; tone?: Tone; badge?: number; onClick?: () => void }) {
  const inner = (
    <>
      {!!badge && <span className="absolute end-2.5 top-2.5 rounded-full bg-peach-500 px-1.5 text-[10px] font-extrabold text-white">{badge}</span>}
      <span className={`grid h-11 w-11 place-items-center rounded-[15px] ${TONES[tone]}`}>{icon}</span>
      <span className="text-[13px] font-semibold leading-tight">{label}</span>
    </>
  );
  const cls = "relative flex flex-col items-center gap-2 rounded-[20px] bg-white px-2 py-3.5 text-center shadow-[0_1px_2px_rgba(23,38,46,.05)] transition hover:shadow-md";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

/** One row of a settings-style list. */
export function Row({ href, icon, label, extra, danger, onClick }: { href?: string; icon: React.ReactNode; label: string; extra?: React.ReactNode; danger?: boolean; onClick?: () => void }) {
  const cls = `flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-start text-[15px] font-medium last:border-0 hover:bg-mint ${danger ? "text-[#B4442D]" : ""}`;
  const inner = <><span className="text-ink-500">{icon}</span><span className="flex-1">{label}</span>{extra}<ChevronLeft className="h-4 w-4 text-slate-400 ltr:rotate-180" /></>;
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export function PageHead({ title, sub, back }: { title: string; sub?: React.ReactNode; back?: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {back && <Link href={back} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm" aria-label="back"><ChevronRight className="h-5 w-5 ltr:rotate-180" /></Link>}
      <div className="min-w-0"><h1 className="text-2xl font-extrabold">{title}</h1>{sub && <div className="text-sm text-ink-500">{sub}</div>}</div>
    </div>
  );
}

const STATUS: Record<string, [SKey, Tone]> = {
  pending: ["rs_pending", "sun"], approved: ["rs_approved", "green"], rejected: ["rs_rejected", "grey"],
  open: ["ts_open", "sun"], answered: ["ts_answered", "sky"], solved: ["ts_solved", "green"],
};
export function StatusPill({ s }: { s: string }) {
  const { ts } = useTs();
  const [k, tone] = STATUS[s] ?? ["error", "grey"];
  return <span className={`chip ${TONES[tone]}`}>{ts(k)}</span>;
}

export const fmtDate = (d: string, lang: string) => new Date(d).toLocaleDateString(lang === "en" ? "en-GB" : lang, { day: "numeric", month: "short" });
