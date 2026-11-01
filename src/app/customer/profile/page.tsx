"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Building2, Trash2, UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import PhotoUpload from "@/components/PhotoUpload";
import { Avatar, Spinner } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTm, MKey } from "@/lib/i18n-marketplace";
import { supabase, explainError } from "@/lib/supabase";

const CATEGORIES = ["restaurant", "retail", "pharmacy", "ecommerce", "warehouse", "other"] as const;

/** Personal profile + the hub for adding roles to the same account (courier, business). */
export default function CustomerProfile() {
  const ok = useRequireRole("customer");
  const { session, profile, roles, memberships, refresh, setActiveRole, setActiveBusiness } = useAuth();
  const { t } = useI18n();
  const { tm } = useTm();
  const router = useRouter();
  const [f, setF] = useState({ full_name: "", phone: "" });
  const [msg, setMsg] = useState("");
  const [biz, setBiz] = useState({ name: "", category: "retail" as (typeof CATEGORIES)[number], phone: "" });
  const [bizOpen, setBizOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ id: number; label: string; address: string }[]>([]);

  useEffect(() => { if (profile) setF({ full_name: profile.full_name, phone: profile.phone || "" }); }, [profile]);
  useEffect(() => {
    if (session) supabase.from("saved_addresses").select("id,label,address").eq("user_id", session.user.id).then(({ data }) => setSaved(data ?? []));
  }, [session]);

  if (!ok || !profile) return <AppShell><Spinner /></AppShell>;
  const uid = session!.user.id;

  const save = async () => {
    await supabase.from("profiles").update({ full_name: f.full_name, phone: f.phone }).eq("id", uid);
    await refresh(); setMsg(t("saved")); setTimeout(() => setMsg(""), 2000);
  };
  const becomeCourier = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("add_role", { p_role: "courier" });
    if (error) { setErr(explainError(error.message)); setBusy(false); return; }
    await refresh(); setActiveRole("courier"); router.push("/courier/profile");
  };
  const createBusiness = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { data, error } = await supabase.rpc("create_business", { p_name: biz.name, p_category: biz.category, p_phone: biz.phone || null });
    if (error) { setErr(explainError(error.message)); setBusy(false); return; }
    await refresh(); setActiveBusiness(data as string); setActiveRole("business"); router.push("/business/profile");
  };

  return (
    <AppShell>
      <h1 className="mb-5 text-2xl font-extrabold">{t("profile")}</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card space-y-4 p-5">
          <PhotoUpload userId={uid} url={profile.avatar_url} folder="avatar" size={88} placeholder={<UserRound className="h-8 w-8" />} label={t("your_photo")}
            onUploaded={async (url) => { await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid); await refresh(); }} />
          <div><label className="label">{t("full_name")}</label><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div><label className="label">{t("phone")}</label><input className="input" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <button onClick={save} className="btn-primary w-full">{msg || t("save")}</button>
          {saved.length > 0 && (
            <div className="border-t pt-3">
              <div className="mb-1 text-sm font-bold">{t("saved_addresses")}</div>
              {saved.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span>{s.label}</span><span className="flex-1 truncate text-slate-500">{s.address}</span>
                  <button onClick={async () => { await supabase.from("saved_addresses").delete().eq("id", s.id); setSaved(saved.filter((x) => x.id !== s.id)); }}><Trash2 className="h-4 w-4 text-red-500" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-3 p-5">
          <div className="font-bold">{tm("your_roles")}</div>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => <span key={r} className="chip bg-brand-50 text-brand-700">{tm(`role_${r}` as MKey)}</span>)}
          </div>

          {roles.includes("courier") ? (
            <button onClick={() => { setActiveRole("courier"); router.push("/courier"); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-start hover:bg-slate-50">
              <Bike className="h-6 w-6 text-brand-600" /><div className="flex-1 font-semibold">{tm("role_courier")}</div><span className="text-sm text-brand-700">{tm("open")}</span>
            </button>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-4">
              <div className="flex items-center gap-2 font-semibold"><Bike className="h-5 w-5" />{tm("become_courier")}</div>
              <p className="mb-3 text-xs text-slate-500">{tm("become_courier_hint")}</p>
              <button disabled={busy} onClick={becomeCourier} className="btn-dark w-full">{tm("become_courier")}</button>
            </div>
          )}

          {memberships.map((m) => (
            <button key={m.business_id} onClick={() => { setActiveBusiness(m.business_id); setActiveRole("business"); router.push("/business"); }}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-start hover:bg-slate-50">
              <Avatar src={m.business.logo_url} name={m.business.business_name} size={36} square />
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{m.business.business_name}</div><div className="text-xs text-slate-500">{tm(`m_${m.member_role}` as MKey)}</div></div>
              <span className="text-sm text-brand-700">{tm("open")}</span>
            </button>
          ))}

          {bizOpen ? (
            <form onSubmit={createBusiness} className="space-y-2 rounded-2xl border border-slate-200 p-4">
              <input className="input" required placeholder={t("business_name")} value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} />
              <select className="input" value={biz.category} onChange={(e) => setBiz({ ...biz, category: e.target.value as typeof biz.category })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{tm(`cat_${c}` as MKey)}</option>)}
              </select>
              <input className="input" dir="ltr" placeholder={t("phone")} value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} />
              <div className="flex gap-2"><button disabled={busy} className="btn-primary flex-1">{tm("create")}</button><button type="button" onClick={() => setBizOpen(false)} className="btn-ghost">{t("back")}</button></div>
            </form>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-4">
              <div className="flex items-center gap-2 font-semibold"><Building2 className="h-5 w-5" />{tm("create_business")}</div>
              <p className="mb-3 text-xs text-slate-500">{tm("create_business_hint")}</p>
              <button onClick={() => setBizOpen(true)} className="btn-ghost w-full">{tm("create_business")}</button>
            </div>
          )}
          {err && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        </div>
      </div>
    </AppShell>
  );
}
