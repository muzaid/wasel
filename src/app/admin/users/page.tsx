"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase, T } from "@/lib/supabase";
import type { Profile, Role } from "@/lib/types";

export default function AdminUsers() {
  const ok = useRequireRole("admin");
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<(Profile & { businesses: { business_name: string } | null })[] | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "">("");

  const load = () => supabase.from("profiles").select(`*, businesses:${T("businesses")}(business_name)`).order("created_at", { ascending: false })
    .then(({ data }) => setRows((data as never) ?? []));
  useEffect(() => { if (ok) load(); }, [ok]);
  const list = useMemo(() => (rows ?? []).filter((r) => (!role || r.role === role) &&
    (!q || [r.full_name, r.phone, r.businesses?.business_name].some((x) => x?.toLowerCase().includes(q.toLowerCase())))), [rows, q, role]);

  if (!ok || !rows) return <AppShell wide><Spinner /></AppShell>;
  const upd = async (id: string, patch: Partial<Profile>) => { await supabase.from("profiles").update(patch).eq("id", id); load(); };

  return (
    <AppShell wide>
      <h1 className="mb-4 text-2xl font-extrabold">{t("users")} <span className="text-base text-slate-400">({list.length})</span></h1>
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[10rem]" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="">{t("all")}</option><option value="business">{t("business")}</option><option value="courier">{t("courier")}</option><option value="admin">{t("admin")}</option>
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-start">{t("full_name")}</th><th className="p-3 text-start">{t("phone")}</th><th className="p-3 text-start">{t("role")}</th><th className="p-3 text-start">{t("date")}</th><th className="p-3" /></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className={`border-t ${r.is_blocked ? "bg-red-50/50" : ""}`}>
                <td className="p-3 font-semibold">{r.full_name}{r.businesses?.business_name && <div className="text-xs font-normal text-slate-500">{r.businesses.business_name}</div>}</td>
                <td className="p-3" dir="ltr">{r.phone}</td>
                <td className="p-3"><span className="chip bg-slate-100">{t(r.role)}</span></td>
                <td className="p-3 text-slate-500">{new Date(r.created_at).toLocaleDateString(lang === "en" ? "en-GB" : lang)}</td>
                <td className="p-3 text-end">
                  {r.role !== "admin" && <button onClick={() => upd(r.id, { is_blocked: !r.is_blocked })} className={r.is_blocked ? "btn-ghost" : "btn-danger"}>{r.is_blocked ? t("unblock") : t("block")}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
