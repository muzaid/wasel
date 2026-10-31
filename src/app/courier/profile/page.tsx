"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Upload, UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import PhotoUpload from "@/components/PhotoUpload";
import { Spinner, vehicleEmoji } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { supabase, uploadFile } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

export default function CourierProfile() {
  const ok = useRequireRole("courier");
  const { session, profile, courier, refresh } = useAuth();
  const { t } = useI18n();
  const [f, setF] = useState({ full_name: "", phone: "", vehicle: "motorcycle" as Vehicle, vehicle_model: "", vehicle_color: "", plate_number: "" });
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState("");

  useEffect(() => {
    if (profile && courier) setF({ full_name: profile.full_name, phone: profile.phone || "", vehicle: courier.vehicle, vehicle_model: courier.vehicle_model || "", vehicle_color: courier.vehicle_color || "", plate_number: courier.plate_number || "" });
  }, [profile, courier]);

  if (!ok || !courier || !profile) return <AppShell><Spinner /></AppShell>;
  const uid = session!.user.id;

  const save = async () => {
    await supabase.from("profiles").update({ full_name: f.full_name, phone: f.phone }).eq("id", uid);
    await supabase.from("couriers").update({ vehicle: f.vehicle, vehicle_model: f.vehicle_model, vehicle_color: f.vehicle_color, plate_number: f.plate_number }).eq("id", uid);
    await refresh(); setMsg(t("saved")); setTimeout(() => setMsg(""), 2000);
  };
  const up = async (field: "id_doc_url" | "license_doc_url", file?: File) => {
    if (!file) return;
    setUploading(field);
    try {
      const url = await uploadFile(uid, file, field);
      await supabase.from("couriers").update({ [field]: url }).eq("id", uid);
      await refresh();
    } finally { setUploading(""); }
  };

  const docs: [("id_doc_url" | "license_doc_url"), TKey, string | null][] = [
    ["id_doc_url", "id_doc", courier.id_doc_url], ["license_doc_url", "license_doc", courier.license_doc_url],
  ];
  const vstyle = { pending: "bg-amber-50 text-amber-700", approved: "bg-brand-50 text-brand-700", rejected: "bg-red-50 text-red-700" }[courier.verification];

  return (
    <AppShell>
      <div className="mb-5 flex items-center gap-3">
        <h1 className="text-2xl font-extrabold">{t("profile")}</h1>
        <span className={`chip ${vstyle}`}>{t("verification")}: {t(courier.verification)}</span>
      </div>
      <div className="card mb-6 p-5">
        <PhotoUpload userId={uid} url={profile.avatar_url} folder="avatar" size={104}
          placeholder={<UserRound className="h-9 w-9" />} label={t("your_photo")} hint={t("photo_hint")}
          onUploaded={async (url) => { await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid); await refresh(); }} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card space-y-3 p-5">
          <div><label className="label">{t("full_name")}</label><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div><label className="label">{t("phone")}</label><input className="input" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <label className="label">{t("vehicle")}</label>
          <div className="grid grid-cols-4 gap-2">
            {(["bike", "motorcycle", "car", "van"] as Vehicle[]).map((v) => (
              <button key={v} onClick={() => setF({ ...f, vehicle: v })} className={`rounded-xl border-2 p-2 text-center text-xs font-semibold ${f.vehicle === v ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                <div className="text-xl">{vehicleEmoji(v)}</div>{t(v)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder={t("vehicle_model")} value={f.vehicle_model} onChange={(e) => setF({ ...f, vehicle_model: e.target.value })} />
            <input className="input" placeholder={t("vehicle_color")} value={f.vehicle_color} onChange={(e) => setF({ ...f, vehicle_color: e.target.value })} />
            <input className="input" dir="ltr" placeholder={t("plate")} value={f.plate_number} onChange={(e) => setF({ ...f, plate_number: e.target.value })} />
          </div>
          <button onClick={save} className="btn-primary w-full">{msg || t("save")}</button>
        </div>
        <div className="card space-y-3 p-5">
          <div className="font-bold">{t("documents")}</div>
          {docs.map(([field, label, url]) => (
            <div key={field} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : <div className="h-12 w-12 rounded-lg bg-slate-100" />}
              <div className="flex-1 text-sm font-semibold">{t(label)} {url && <CheckCircle2 className="inline h-4 w-4 text-brand-600" />}</div>
              <label className="btn-ghost cursor-pointer"><Upload className="h-4 w-4" />{uploading === field ? "…" : t("upload")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => up(field, e.target.files?.[0])} />
              </label>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
