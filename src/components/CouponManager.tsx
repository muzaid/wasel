"use client";
import { useEffect, useState } from "react";
import { Loader2, Percent, Trash2 } from "lucide-react";
import { Empty, Spinner } from "@/components/ui";
import { fmtDate } from "@/components/support";
import { useI18n } from "@/lib/i18n";
import { useTs, supportErr } from "@/lib/i18n-support";
import { supabase, T } from "@/lib/supabase";
import { money } from "@/lib/geo";
import type { Coupon } from "@/lib/types";

const blank = { code: "", title: "", kind: "percent" as "percent" | "fixed", value: "", max_discount: "", min_price: "", max_uses: "", per_user_limit: "1", ends_at: "", is_public: true };

/**
 * Create and manage coupons.
 *  - businessId set: that business's discount codes (owner / manager)
 *  - businessId null: Wasel coupons (admin); `showBusinessCodes` also lists every business's codes
 */
export default function CouponManager({ businessId, showBusinessCodes = false }: { businessId: string | null; showBusinessCodes?: boolean }) {
  const { lang } = useI18n();
  const { ts } = useTs();
  const [rows, setRows] = useState<(Coupon & { business?: { business_name: string } | null })[] | null>(null);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    let q = supabase.from("coupons").select(`*, business:${T("businesses")}(business_name)`).order("created_at", { ascending: false });
    q = businessId ? q.eq("business_id", businessId) : showBusinessCodes ? q : q.is("business_id", null);
    q.then(({ data }) => setRows((data as never) ?? []));
  };
  useEffect(load, [businessId, showBusinessCodes]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.from("coupons").insert({
      code: f.code, title: f.title || null, business_id: businessId, kind: f.kind, value: Number(f.value),
      max_discount: f.kind === "percent" && f.max_discount ? Number(f.max_discount) : null, min_price: Number(f.min_price) || 0,
      max_uses: f.max_uses ? Number(f.max_uses) : null, per_user_limit: Math.max(1, Number(f.per_user_limit) || 1),
      ends_at: f.ends_at ? new Date(f.ends_at + "T23:59:59").toISOString() : null, is_public: f.is_public,
    });
    setBusy(false);
    if (error) { setErr(error.message.includes("duplicate") ? `${f.code.toUpperCase()} ✕` : ts(supportErr(error.message))); return; }
    setF(blank); load();
  };
  const toggle = async (c: Coupon) => { await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id); load(); };
  const remove = async (c: Coupon) => { await supabase.from("coupons").delete().eq("id", c.id); load(); };
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (!rows) return <Spinner />;
  const mine = rows.filter((r) => (businessId ? true : r.business_id === null));
  const others = businessId ? [] : rows.filter((r) => r.business_id !== null);

  const list = (items: typeof rows, editable: boolean) => (
    <div className="space-y-2.5">
      {items.map((c) => {
        const pct = c.max_uses ? Math.min(100, (c.used_count / c.max_uses) * 100) : 0;
        const ended = !!c.ends_at && new Date(c.ends_at) < new Date();
        return (
          <div key={c.id} className={`card p-4 ${!c.active || ended ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-extrabold tracking-wide" dir="ltr">{c.code} <span className="chip ms-1 bg-sun-50 text-sun-700">{c.kind === "percent" ? `${Number(c.value)}%` : money(c.value)}</span></div>
                <div className="truncate text-sm text-ink-500">
                  {c.business?.business_name ? `${c.business.business_name} · ` : ""}{c.title || ""}{c.ends_at ? ` · ${ts("ends")} ${fmtDate(c.ends_at, lang)}` : ""}
                  {Number(c.min_price) > 0 ? ` · ${ts("min_order")} ${money(c.min_price)}` : ""}
                </div>
              </div>
              {editable && (
                <>
                  <button type="button" role="switch" aria-checked={c.active} onClick={() => toggle(c)} title={c.active ? ts("active") : ts("paused")}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${c.active ? "bg-brand-600" : "bg-slate-300"}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${c.active ? "end-1" : "start-1"}`} />
                  </button>
                  {c.used_count === 0 && <button type="button" onClick={() => remove(c)} aria-label={ts("delete")} className="grid h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                </>
              )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-sun-400" style={{ width: `${c.max_uses ? pct : c.used_count ? 100 : 0}%` }} /></div>
            <div className="mt-1 text-xs text-ink-500">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""} {ts("used")}</div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="card space-y-3 border-2 border-brand-600 p-5">
        <div className="text-lg font-extrabold">{ts("new_code")}</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_120px]">
          <input className="input font-bold uppercase tracking-wide" dir="ltr" placeholder="SUMMER15" value={f.code} onChange={set("code")} required pattern="[A-Za-z0-9_\-]{3,24}" />
          <div className="flex rounded-2xl bg-ink-100 p-1">
            {(["percent", "fixed"] as const).map((k) => (
              <button type="button" key={k} onClick={() => setF({ ...f, kind: k })} className={`w-12 rounded-xl text-sm font-bold ${f.kind === k ? "bg-white shadow" : "text-ink-500"}`}>{ts(k === "percent" ? "kind_percent" : "kind_fixed")}</button>
            ))}
          </div>
          <input className="input" type="number" min="1" max={f.kind === "percent" ? 100 : undefined} step="0.5" placeholder={ts("value")} value={f.value} onChange={set("value")} required />
        </div>
        <input className="input" placeholder={ts("title_optional")} value={f.title} onChange={set("title")} maxLength={80} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">{ts("max_uses")}</span><input className="input" type="number" min="1" value={f.max_uses} onChange={set("max_uses")} /></label>
          <label><span className="label">{ts("per_user")}</span><input className="input" type="number" min="1" value={f.per_user_limit} onChange={set("per_user_limit")} /></label>
          <label><span className="label">{ts("min_price")}</span><input className="input" type="number" min="0" value={f.min_price} onChange={set("min_price")} /></label>
          <label><span className="label">{ts("ends_at")}</span><input className="input" type="date" value={f.ends_at} onChange={set("ends_at")} /></label>
          {f.kind === "percent" && <label><span className="label">{ts("max_discount")}</span><input className="input" type="number" min="1" value={f.max_discount} onChange={set("max_discount")} /></label>}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.is_public} onChange={(e) => setF({ ...f, is_public: e.target.checked })} />{ts("show_in_list")}</label>
        <p className="text-sm text-ink-500">{businessId ? `${ts("business_pays_note")} ${ts("discount_codes_hint")}` : ts("wasel_pays_note")}</p>
        {err && <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : ts("create_code")}</button>
      </form>
      {mine.length === 0 ? <Empty icon={<Percent className="h-6 w-6" />} title={ts("no_coupons")} /> : list(mine, true)}
      {others.length > 0 && <><h2 className="text-lg font-extrabold">{ts("business_codes")}</h2>{list(others, true)}</>}
    </div>
  );
}
