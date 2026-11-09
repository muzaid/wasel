"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Percent, Wallet } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Empty, Spinner } from "@/components/ui";
import { PageHead, fmtDate } from "@/components/support";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTs, SKey } from "@/lib/i18n-support";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/geo";
import type { CreditTx, MyCoupon } from "@/lib/types";

const couponText = (c: { kind: string; value: number }) => (c.kind === "percent" ? `${Number(c.value)}%` : money(c.value));

/** Wasel credit balance + history, and the coupons this person can use. */
export default function CouponsPage() {
  const { session, loading } = useAuth();
  const { lang } = useI18n();
  const { ts } = useTs();
  const router = useRouter();
  const [coupons, setCoupons] = useState<MyCoupon[] | null>(null);
  const [balance, setBalance] = useState(0);
  const [tx, setTx] = useState<CreditTx[]>([]);
  const [copied, setCopied] = useState("");
  const uid = session?.user.id;

  useEffect(() => { if (!loading && !session) router.replace("/login?next=/coupons"); }, [loading, session, router]);
  useEffect(() => {
    if (!uid) return;
    supabase.rpc("my_coupons").then(({ data }) => setCoupons((data as MyCoupon[]) ?? []));
    supabase.from("wallets").select("balance").eq("user_id", uid).maybeSingle().then(({ data }) => setBalance(Number(data?.balance ?? 0)));
    supabase.from("credit_tx").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(30).then(({ data }) => setTx((data as CreditTx[]) ?? []));
  }, [uid]);

  if (!coupons) return <AppShell><Spinner /></AppShell>;
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); } catch { /* ignore */ } setCopied(code); setTimeout(() => setCopied(""), 1500); };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-5">
        <PageHead title={ts("coupons")} back="/account" />
        <div className="rounded-3xl bg-brand-600 p-5 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold opacity-85"><Wallet className="h-4 w-4" />{ts("wasel_credit")}</div>
          <div className="text-4xl font-extrabold tabular-nums">{money(balance)}</div>
          <div className="mt-1 text-sm opacity-85">{ts("credit_hint")}</div>
        </div>

        <section>
          <h2 className="mb-2 text-lg font-extrabold">{ts("my_coupons")}</h2>
          {coupons.length === 0 && <Empty icon={<Percent className="h-6 w-6" />} title={ts("no_coupons")} />}
          <div className="space-y-2.5">
            {coupons.map((c) => (
              <div key={c.code} className="flex overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(23,38,46,.05)]">
                <div className={`grid w-20 shrink-0 place-items-center border-e-2 border-dashed border-white text-lg font-extrabold ${c.business_id ? "bg-sky2-50 text-sky2-700" : "bg-brand-50 text-brand-700"}`}>{couponText(c)}</div>
                <div className="min-w-0 flex-1 px-4 py-3">
                  <div className="font-extrabold tracking-wide" dir="ltr">{c.code}</div>
                  <div className="truncate text-sm text-ink-700">{c.title || couponText(c)}</div>
                  <div className="text-xs text-ink-500">
                    {c.business_name ? c.business_name : ts("from_wasel")} · {c.uses_left} {ts("uses_left")}
                    {c.ends_at && ` · ${ts("ends")} ${fmtDate(c.ends_at, lang)}`}{Number(c.min_price) > 0 && ` · ${ts("min_order")} ${money(c.min_price)}`}
                  </div>
                </div>
                <button type="button" onClick={() => copy(c.code)} className="me-3 self-center rounded-full bg-ink-100 px-3 py-1.5 text-xs font-bold">
                  {copied === c.code ? <Check className="h-4 w-4 text-brand-600" /> : <span className="flex items-center gap-1"><Copy className="h-3.5 w-3.5" />{ts("copy_code")}</span>}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-500">{ts("coupon_sender_only")}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-extrabold">{ts("credit_history")}</h2>
          <div className="card overflow-hidden">
            {tx.length === 0 && <div className="p-4 text-sm text-ink-500">{ts("no_credit_history")}</div>}
            {tx.map((x) => (
              <div key={x.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm last:border-0">
                <div><div className="font-semibold">{ts(`cr_${x.reason}` as SKey)}</div><div className="text-xs text-ink-500">{fmtDate(x.created_at, lang)}{x.note ? ` · ${x.note}` : ""}</div></div>
                <div className={`font-bold tabular-nums ${x.amount > 0 ? "text-brand-600" : ""}`} dir="ltr">{x.amount > 0 ? "+" : "−"}{money(Math.abs(x.amount))}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
