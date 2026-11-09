"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { PageHead, StatusPill, fmtDate } from "@/components/support";
import { useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTm, MKey } from "@/lib/i18n-marketplace";
import { useTs, SKey } from "@/lib/i18n-support";
import { supabase } from "@/lib/supabase";
import type { Ticket } from "@/lib/types";

/** Admin: every help-desk request and contact-us message. */
export default function AdminTickets() {
  const ok = useRequireRole("admin");
  const { lang } = useI18n();
  const { tm } = useTm();
  const { ts } = useTs();
  const [rows, setRows] = useState<Ticket[] | null>(null);
  const [filter, setFilter] = useState<"open" | "answered" | "solved" | "">("open");
  useEffect(() => {
    if (!ok) return;
    const load = () => supabase.from("tickets").select("*").order("updated_at", { ascending: false }).limit(300).then(({ data }) => setRows((data as Ticket[]) ?? []));
    load();
    const i = setInterval(() => { if (!document.hidden) load(); }, 20000);
    return () => clearInterval(i);
  }, [ok]);
  const list = useMemo(() => (rows ?? []).filter((r) => !filter || r.status === filter), [rows, filter]);
  if (!ok || !rows) return <AppShell wide><Spinner /></AppShell>;
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <AppShell wide>
      <PageHead title={ts("tickets")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {([["open", "ts_open"], ["answered", "ts_answered"], ["solved", "ts_solved"], ["", "all"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`chip px-3.5 py-2 text-sm ${filter === k ? "bg-ink-900 text-white" : "bg-white shadow-sm"}`}>
            {ts(l as SKey)}{k ? ` · ${count(k)}` : ""}
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        {list.length === 0 && <div className="p-6 text-center text-ink-500">{ts("no_tickets")}</div>}
        {list.map((t) => (
          <Link key={t.id} href={`/admin/tickets/${t.id}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-mint">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{t.subject}</div>
              <div className="truncate text-sm text-ink-500">
                {t.name || "—"} · {t.user_id ? (t.role ? tm(`role_${t.role}` as MKey) : "") : ts("from_guest")} · {ts(`tp_${t.topic}` as SKey)} · {fmtDate(t.updated_at, lang)}
              </div>
            </div>
            <StatusPill s={t.status} />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
