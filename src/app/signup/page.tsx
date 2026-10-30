"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Bike } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { useAuth, homeFor } from "@/lib/auth";
import type { Vehicle } from "@/lib/types";
import { LangSwitch, Logo, vehicleEmoji } from "@/components/ui";

function SignupForm() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<"business" | "courier">(params.get("role") === "courier" ? "courier" : "business");
  const [f, setF] = useState({ email: "", password: "", full_name: "", phone: "", business_name: "", vehicle: "motorcycle" as Vehicle, plate_number: "", vehicle_model: "", vehicle_color: "" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (profile) router.replace(homeFor(profile.role)); }, [profile, router]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { email, password, ...meta } = f;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { ...meta, role, app: "wasel" } } });
    if (error) setErr(error.message);
    else if (!data.session) setMsg("✓ Check your email to confirm your account.");
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between"><Link href="/"><Logo /></Link><LangSwitch /></div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <h1 className="text-xl font-extrabold">{t("signup")}</h1>
          <div className="grid grid-cols-2 gap-2">
            {([["business", <Building2 key="b" className="h-5 w-5" />], ["courier", <Bike key="c" className="h-5 w-5" />]] as const).map(([r, ic]) => (
              <button type="button" key={r} onClick={() => setRole(r)}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-bold transition ${role === r ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500"}`}>
                {ic}{t(r)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">{t("full_name")}</label><input className="input" required value={f.full_name} onChange={set("full_name")} /></div>
            {role === "business" && <div className="col-span-2"><label className="label">{t("business_name")}</label><input className="input" required value={f.business_name} onChange={set("business_name")} /></div>}
            <div className="col-span-2"><label className="label">{t("phone")}</label><input dir="ltr" className="input" type="tel" required placeholder="059xxxxxxx" value={f.phone} onChange={set("phone")} /></div>
            <div className="col-span-2"><label className="label">{t("email")}</label><input dir="ltr" className="input" type="email" required value={f.email} onChange={set("email")} /></div>
            <div className="col-span-2"><label className="label">{t("password")}</label><input dir="ltr" className="input" type="password" minLength={6} required value={f.password} onChange={set("password")} /></div>
          </div>
          {role === "courier" && (
            <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
              <label className="label">{t("vehicle")}</label>
              <div className="grid grid-cols-4 gap-2">
                {(["bike", "motorcycle", "car", "van"] as Vehicle[]).map((v) => (
                  <button type="button" key={v} onClick={() => setF({ ...f, vehicle: v })}
                    className={`rounded-xl border-2 bg-white p-2 text-center text-xs font-semibold ${f.vehicle === v ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>
                    <div className="text-2xl">{vehicleEmoji(v)}</div>{t(v)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input className="input" placeholder={t("vehicle_model")} value={f.vehicle_model} onChange={set("vehicle_model")} />
                <input className="input" placeholder={t("vehicle_color")} value={f.vehicle_color} onChange={set("vehicle_color")} />
                <input className="input" dir="ltr" placeholder={t("plate")} value={f.plate_number} onChange={set("plate_number")} />
              </div>
            </div>
          )}
          {err && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</div>}
          {msg && <div className="rounded-lg bg-brand-50 p-2 text-sm text-brand-700">{msg}</div>}
          <button className="btn-primary w-full py-3" disabled={busy}>{busy ? t("loading") : t("signup")}</button>
          <p className="text-center text-sm text-slate-500">{t("have_account")} <Link className="font-semibold text-brand-700" href="/login">{t("login")}</Link></p>
        </form>
      </div>
    </div>
  );
}

export default function Signup() {
  return <Suspense><SignupForm /></Suspense>;
}
