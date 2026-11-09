"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Tag, Zap } from "lucide-react";
import AppShell from "@/components/AppShell";
import { PageHead } from "@/components/support";
import { useI18n } from "@/lib/i18n";
import { useTs } from "@/lib/i18n-support";
import { supabase } from "@/lib/supabase";

/** About us — the story, values and a few live numbers. */
export default function AboutPage() {
  const { t } = useI18n();
  const { ts } = useTs();
  const [stats, setStats] = useState<{ deliveries: number; couriers: number } | null>(null);
  useEffect(() => {
    supabase.rpc("public_stats").then(({ data }) => {
      const d = data as { deliveries?: number; couriers?: number } | null;
      if (d && typeof d.deliveries === "number" && typeof d.couriers === "number") setStats({ deliveries: d.deliveries, couriers: d.couriers });
    });
  }, []);
  const values = [[<Zap key="1" className="h-6 w-6" />, "v1", "bg-brand-50 text-brand-700"], [<Tag key="2" className="h-6 w-6" />, "v2", "bg-sun-50 text-sun-700"],
    [<Lock key="3" className="h-6 w-6" />, "v3", "bg-sky2-50 text-sky2-700"]] as const;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHead title={ts("about_us")} back="/" />
        <div className="rounded-[28px] bg-sun-400 p-6">
          <div className="mb-2 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[14px] bg-brand-600 text-xl font-extrabold text-white">W</span>
            <h2 className="text-2xl font-extrabold">{ts("about_title")}</h2></div>
          <p className="text-lg leading-relaxed text-[#3B2E00]">{ts("about_text")}</p>
        </div>
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 text-center"><div className="text-3xl font-extrabold tabular-nums">{stats.deliveries.toLocaleString()}</div><div className="text-sm text-ink-500">{t("deliveries")}</div></div>
            <div className="card p-4 text-center"><div className="text-3xl font-extrabold tabular-nums">{stats.couriers.toLocaleString()}</div><div className="text-sm text-ink-500">{t("couriers")}</div></div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          {values.map(([icon, k, tone]) => (
            <div key={k} className="card p-5">
              <span className={`mb-3 grid h-12 w-12 place-items-center rounded-2xl ${tone}`}>{icon}</span>
              <div className="text-lg font-bold">{ts(k)}</div>
              <p className="mt-1 text-sm text-ink-500">{ts(`${k}d` as "v1d")}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/contact" className="btn-dark">{ts("contact_us")}</Link>
          <Link href="/signup?role=courier" className="btn-ghost">{t("for_courier")}</Link>
          <Link href="/signup?role=business" className="btn-ghost">{t("for_business")}</Link>
        </div>
      </div>
    </AppShell>
  );
}
