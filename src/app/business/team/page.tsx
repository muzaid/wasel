"use client";
import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Avatar, Spinner } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTm, MKey } from "@/lib/i18n-marketplace";
import { supabase, explainError } from "@/lib/supabase";
import type { MemberRole } from "@/lib/types";

interface Member { user_id: string; full_name: string; email: string; phone: string | null; avatar_url: string | null; member_role: MemberRole }

/** Business employees: owner and managers add dispatchers/managers by the email they signed up with. */
export default function Team() {
  const ok = useRequireRole("business");
  const { session, business, membership } = useAuth();
  const { t } = useI18n();
  const { tm } = useTm();
  const [team, setTeam] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"dispatcher" | "manager">("dispatcher");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = membership?.member_role === "owner" || membership?.member_role === "manager";

  const load = useCallback(() => {
    if (!business) return;
    supabase.rpc("business_team", { p_business: business.id }).then(({ data, error }) => {
      if (error) setErr(explainError(error.message)); setTeam((data as Member[]) ?? []);
    });
  }, [business]);
  useEffect(() => { if (ok) load(); }, [ok, load]);

  if (!ok || !business || !team) return <AppShell><Spinner /></AppShell>;

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await supabase.rpc("add_member", { p_business: business.id, p_email: email, p_role: role });
    setBusy(false);
    if (error) setErr(error.message.includes("user_not_found") ? tm("user_not_found") : explainError(error.message));
    else { setEmail(""); load(); }
  };
  const remove = async (uid: string) => {
    await supabase.rpc("remove_member", { p_business: business.id, p_user: uid }); load();
  };

  return (
    <AppShell>
      <h1 className="mb-5 text-2xl font-extrabold">{tm("team")} · <span className="text-slate-500">{business.business_name}</span></h1>
      {canManage && (
        <form onSubmit={add} className="card mb-6 space-y-3 p-5">
          <div className="flex items-center gap-2 font-bold"><UserPlus className="h-5 w-5" />{tm("add_member")}</div>
          <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
            <input className="input" type="email" dir="ltr" required placeholder={tm("member_email")} value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="dispatcher">{tm("m_dispatcher")}</option>
              {membership?.member_role === "owner" && <option value="manager">{tm("m_manager")}</option>}
            </select>
            <button disabled={busy} className="btn-primary">{tm("add_member")}</button>
          </div>
          <p className="text-xs text-slate-500">{tm("member_hint")}</p>
          {err && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        </form>
      )}
      <div className="card divide-y">
        {team.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 p-4">
            <Avatar src={m.avatar_url} name={m.full_name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{m.full_name || m.email}</div>
              <div className="truncate text-xs text-slate-500" dir="ltr">{m.email}{m.phone ? ` · ${m.phone}` : ""}</div>
            </div>
            <span className={`chip ${m.member_role === "owner" ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-600"}`}>{tm(`m_${m.member_role}` as MKey)}</span>
            {canManage && m.member_role !== "owner" && m.user_id !== session?.user.id && (
              <button onClick={() => remove(m.user_id)} className="text-sm font-semibold text-red-600">{tm("remove")}</button>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">{t("role")}: {tm(`m_${membership?.member_role ?? "dispatcher"}` as MKey)}</p>
    </AppShell>
  );
}
