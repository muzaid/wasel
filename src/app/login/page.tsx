"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, explainError } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { useAuth, homeFor } from "@/lib/auth";
import PhoneOtp, { MethodTabs } from "@/components/PhoneOtp";
import { LangSwitch, Logo } from "@/components/ui";

function LoginForm() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (profile) router.replace(next && next.startsWith("/") ? next : homeFor(profile.role)); }, [profile, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(explainError(error.message));
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between"><Link href="/"><Logo /></Link><LangSwitch /></div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <h1 className="text-xl font-extrabold">{t("login")}</h1>
          <MethodTabs method={method} setMethod={(m) => { setMethod(m); setErr(""); }} />
          {method === "email" ? (
            <>
              <div><label className="label">{t("email")}</label><input dir="ltr" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><label className="label">{t("password")}</label><input dir="ltr" className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              {err && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</div>}
              <button className="btn-primary w-full py-3" disabled={busy}>{busy ? t("loading") : t("login")}</button>
            </>
          ) : (
            <>
              <PhoneOtp create={false} onError={setErr} />
              {err && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</div>}
            </>
          )}
          <p className="text-center text-sm text-slate-500">{t("no_account")} <Link className="font-semibold text-brand-700" href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>{t("signup")}</Link></p>
        </form>
      </div>
    </div>
  );
}

export default function Login() {
  return <Suspense><LoginForm /></Suspense>;
}
