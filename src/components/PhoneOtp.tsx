"use client";
import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTm } from "@/lib/i18n-marketplace";
import { toE164 } from "@/lib/draft";

/**
 * Phone sign-in / sign-up with a 6-digit SMS code (Supabase phone auth).
 * Requires an SMS provider (e.g. Twilio) in Supabase → Authentication → Providers → Phone.
 */
export default function PhoneOtp({ create, meta, disabled, onError }: {
  create: boolean; meta?: Record<string, unknown>; disabled?: boolean; onError: (m: string) => void;
}) {
  const { tm } = useTm();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const smsErr = (m: string) => /provider|sms|unsupported|disabled|not enabled/i.test(m) ? tm("sms_not_enabled") : m;

  const send = async () => {
    const e164 = toE164(phone);
    if (e164.length < 11) return onError(tm("phone_hint"));
    setBusy(true); onError("");
    const { error } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: { shouldCreateUser: create, channel: "sms", data: create ? { ...meta, phone: e164, app: "wasel" } : undefined },
    });
    setBusy(false);
    if (error) onError(smsErr(error.message)); else setSentTo(e164);
  };
  const verify = async () => {
    setBusy(true); onError("");
    const { error } = await supabase.auth.verifyOtp({ phone: sentTo, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) onError(error.message);   // on success the auth listener loads the profile and the page redirects
  };

  return sentTo ? (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{tm("code_sent")} <b dir="ltr">{sentTo}</b></p>
      <input className="input text-center font-mono text-2xl tracking-[.4em]" dir="ltr" inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      <button type="button" disabled={busy || code.length < 6} onClick={verify} className="btn-primary w-full py-3">{tm("verify")}</button>
      <button type="button" disabled={busy} onClick={send} className="w-full text-sm font-semibold text-brand-700">{tm("resend")}</button>
    </div>
  ) : (
    <div className="space-y-3">
      <input className="input" dir="ltr" type="tel" autoComplete="tel" placeholder={tm("phone_hint")} value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button type="button" disabled={busy || disabled || !phone} onClick={send} className="btn-primary w-full py-3">
        <MessageSquareText className="h-4 w-4" />{tm("send_code")}
      </button>
    </div>
  );
}

/** Email | Phone (SMS) switch used on the login and sign-up pages. */
export function MethodTabs({ method, setMethod }: { method: "email" | "phone"; setMethod: (m: "email" | "phone") => void }) {
  const { tm } = useTm();
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
      {(["email", "phone"] as const).map((m) => (
        <button type="button" key={m} onClick={() => setMethod(m)}
          className={`rounded-lg py-2 text-sm font-semibold transition ${method === m ? "bg-white text-ink-900 shadow-sm" : "text-slate-500"}`}>
          {tm(m === "email" ? "by_email" : "by_phone")}
        </button>
      ))}
    </div>
  );
}
