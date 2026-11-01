"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Avatar, Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTm, MKey } from "@/lib/i18n-marketplace";
import { supabase, T } from "@/lib/supabase";
import type { Profile, Role } from "@/lib/types";

export default function AdminUsers() {
  const ok = useRequireRole("admin");
  const { t, lang } = useI18n();
  const { tm } = useTm();
  type Row = Profile & { businesses: { business_name: string; logo_url: string | null }[] | null; roles: { role: Role }[] | null };
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "">("");

  const load = () => supabase.from("profiles").select(`*, businesses:${T("businesses")}!owner_id(business_name, logo_url), roles:${T("user_roles")}(role)`).order("created_at", { ascending: false })
    .then(({ data }) => setRows((data as never) ?? []));
  useEffect(() => { if (ok) load(); }, [ok]);
  const rolesOf = (r: Row) => (r.roles?.length ? r.roles.map((x) => x.role) : [r.role]);
  const list = useMemo(() => (rows ?? []).filter((r) => (!role || rolesOf(r).includes(role)) &&
    (!q || [r.full_name, r.phone, ...(r.businesses ?? []).map((b) => b.business_name)].some((x) => x?.toLowerCase().includes(q.toLowerCase())))), [rows, q, role]);

  if (!ok || !rows) return <AppShell wide><Spinner /></AppShell>;
  const upd = async (id: string, patch: Partial<Profile>) => { await supabase.from("profiles").update(patch).eq("id", id); load(); };

  return (
    <AppShell wide>
      <h1 className="mb-4 text-2xl font-extrabold">{t("users")} <span className="text-base text-slate-400">({list.length})</span></h1>
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[10rem]" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="">{t("all")}</option><option value="customer">{tm("customer")}</option><option value="business">{t("business")}</option><option value="courier">{t("courier")}</option><option value="admin">{t("admin")}</option>
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-start">{t("full_name")}</th><th className="p-3 text-start">{t("phone")}</th><th className="p-3 text-start">{t("role")}</th><th className="p-3 text-start">{t("date")}</th><th className="p-3" /></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className={`border-t ${r.is_blocked ? "bg-red-50/50" : ""}`}>
                <td className="p-3 font-semibold">
                  <div className="flex items-center gap-3">
                    {r.businesses?.[0]?.logo_url ? <Avatar src={r.businesses[0].logo_url} name={r.businesses[0].business_name} size={36} square /> : <Avatar src={r.avatar_url} name={r.full_name} size={36} />}
                    <div>{r.full_name}{!!r.businesses?.length && <div className="text-xs font-normal text-slate-500">{r.businesses.map((b) => b.business_name).join(", ")}</div>}</div>
                  </div>
                </td>
                <td className="p-3" dir="ltr">{r.phone}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{rolesOf(r).map((x) => <span key={x} className="chip bg-slate-100">{tm(`role_${x}` as MKey)}</span>)}</div></td>
                <td className="p-3 text-slate-500">{new Date(r.created_at).toLocaleDateString(lang === "en" ? "en-GB" : lang)}</td>
                <td className="p-3 text-end">
                  {!rolesOf(r).includes("admin") && <button onClick={() => upd(r.id, { is_blocked: !r.is_blocked })} className={r.is_blocked ? "btn-ghost" : "btn-danger"}>{r.is_blocked ? t("unblock") : t("block")}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
