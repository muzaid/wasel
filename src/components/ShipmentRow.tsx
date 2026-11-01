"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { money } from "@/lib/geo";
import type { Shipment } from "@/lib/types";
import { StatusBadge } from "./ui";

export default function ShipmentRow({ s, href }: { s: Shipment; href: string }) {
  const { t, lang } = useI18n();
  const { tm } = useTm();
  return (
    <Link href={href} className="card flex items-center gap-4 p-4 transition hover:border-brand-300 hover:shadow-md">
      <div className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 font-mono text-[11px] font-bold text-slate-500 sm:grid">#{s.code.slice(0, 4)}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <StatusBadge s={s.status} />
          <span className="chip bg-slate-100 text-slate-600" title={tm(`type_${s.delivery_type ?? "b2c"}_long`)}>{tm(`type_${s.delivery_type ?? "b2c"}`)}</span>
          <span className="font-mono text-xs text-slate-400">#{s.code}</span>
          {s.cod_amount > 0 && <span className="chip bg-amber-50 text-amber-700">COD {money(s.cod_amount)}</span>}
        </div>
        <div className="truncate text-sm"><span className="text-slate-400">{t("from")}</span> {s.pickup_address}</div>
        <div className="truncate text-sm"><span className="text-slate-400">{t("to")}</span> {s.dropoff_address} · <b>{s.recipient_name}</b></div>
      </div>
      <div className="text-end">
        <div className="font-bold tabular-nums">{money(s.price)}</div>
        <div className="text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString(lang === "en" ? "en-GB" : lang)}</div>
      </div>
      <ChevronLeft className="h-4 w-4 text-slate-300 ltr:rotate-180" />
    </Link>
  );
}
