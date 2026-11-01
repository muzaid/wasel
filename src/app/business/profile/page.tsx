"use client";
import { useEffect, useState } from "react";
import { Store, Trash2, UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import Map from "@/components/Map";
import PhotoUpload from "@/components/PhotoUpload";
import { Spinner } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTm, MKey } from "@/lib/i18n-marketplace";
import { supabase } from "@/lib/supabase";
import { reverseGeocode } from "@/lib/geo";

export default function BusinessProfile() {
  const ok = useRequireRole("business");
  const { session, profile, business, membership, refresh } = useAuth();
  const { t, lang } = useI18n();
  const { tm } = useTm();
  const [f, setF] = useState({ full_name: "", phone: "", business_name: "", address: "", lat: 0, lng: 0, category: "", registration_number: "", email: "", biz_phone: "" });
  const [saved, setSaved] = useState<{ id: number; label: string; address: string }[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (profile && business) setF({ full_name: profile.full_name, phone: profile.phone || "", business_name: business.business_name, address: business.address || "", lat: business.lat || 0, lng: business.lng || 0, category: business.category || "", registration_number: business.registration_number || "", email: business.email || "", biz_phone: business.phone || "" });
  }, [profile, business]);
  useEffect(() => {
    if (business) supabase.from("saved_addresses").select("id,label,address").eq("business_id", business.id).then(({ data }) => setSaved(data ?? []));
  }, [business]);

  if (!ok || !business) return <AppShell><Spinner /></AppShell>;
  const canEdit = membership?.member_role !== "dispatcher";
  const save = async () => {
    const uid = session!.user.id;
    await supabase.from("profiles").update({ full_name: f.full_name, phone: f.phone }).eq("id", uid);
    if (canEdit) await supabase.from("businesses").update({ business_name: f.business_name, address: f.address, lat: f.lat || null, lng: f.lng || null,
      category: f.category || null, registration_number: f.registration_number || null, email: f.email || null, phone: f.biz_phone || null }).eq("id", business.id);
    await refresh(); setMsg(t("saved")); setTimeout(() => setMsg(""), 2000);
  };

  return (
    <AppShell>
      <h1 className="mb-5 text-2xl font-extrabold">{t("profile")}</h1>
      <div className="card mb-6 grid gap-6 p-5 sm:grid-cols-2">
        <PhotoUpload userId={session!.user.id} url={business?.logo_url} folder="logo" shape="square" size={96}
          placeholder={<Store className="h-8 w-8" />} label={t("business_logo")} hint={t("logo_hint")}
          onUploaded={async (url) => { await supabase.from("businesses").update({ logo_url: url }).eq("id", business.id); await refresh(); }} />
        <PhotoUpload userId={session!.user.id} url={profile?.avatar_url} folder="avatar" size={96}
          placeholder={<UserRound className="h-8 w-8" />} label={t("your_photo")}
          onUploaded={async (url) => { await supabase.from("profiles").update({ avatar_url: url }).eq("id", session!.user.id); await refresh(); }} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card space-y-3 p-5">
          <div><label className="label">{t("business_name")}</label><input className="input" value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} /></div>
          <div><label className="label">{t("full_name")}</label><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div><label className="label">{t("phone")}</label><input className="input" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">{tm("business_category")}</label>
              <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                <option value="">—</option>
                {["restaurant", "retail", "pharmacy", "ecommerce", "warehouse", "other"].map((c) => <option key={c} value={c}>{tm(`cat_${c}` as MKey)}</option>)}
              </select></div>
            <div><label className="label">{tm("registration_number")}</label><input className="input" dir="ltr" value={f.registration_number} onChange={(e) => setF({ ...f, registration_number: e.target.value })} /></div>
            <div><label className="label">{tm("business_email")}</label><input className="input" dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><label className="label">{t("phone")} ({t("business")})</label><input className="input" dir="ltr" value={f.biz_phone} onChange={(e) => setF({ ...f, biz_phone: e.target.value })} /></div>
          </div>
          <div className="text-xs text-slate-500">{tm("verification_status")}: <b>{t(business.verification)}</b></div>
          <div><label className="label">{t("address")} ({t("pickup")})</label><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <button onClick={save} className="btn-primary w-full">{msg || t("save")}</button>
        </div>
        <div className="space-y-4">
          <Map markers={f.lat ? [{ id: "b", kind: "pickup", lat: f.lat, lng: f.lng }] : []} fitKey={String(!!f.lat)}
            onPick={async (lat, lng) => setF({ ...f, lat, lng, address: await reverseGeocode(lat, lng, lang) })} />
          <div className="card p-4">
            <div className="mb-2 font-bold">{t("saved_addresses")}</div>
            {saved.map((s) => (
              <div key={s.id} className="flex items-center gap-2 border-b py-2 text-sm last:border-0">
                <span>{s.label}</span><span className="flex-1 truncate text-slate-500">{s.address}</span>
                <button onClick={async () => { await supabase.from("saved_addresses").delete().eq("id", s.id); setSaved(saved.filter((x) => x.id !== s.id)); }}><Trash2 className="h-4 w-4 text-red-500" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
