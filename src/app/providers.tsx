"use client";
import { useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { configProblem, SUPABASE_URL_IN_USE } from "@/lib/supabase";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <I18nProvider>
      <AuthProvider>
        {configProblem && (
          <div dir="ltr" className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900">
            {configProblem === "missing"
              ? "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local locally, or Vercel → Settings → Environment Variables, then Redeploy)."
              : `NEXT_PUBLIC_SUPABASE_URL looks wrong: "${SUPABASE_URL_IN_USE}". It must be the Project URL from Supabase → Project Settings → API, e.g. https://abcd1234.supabase.co`}
          </div>
        )}
        {children}
      </AuthProvider>
    </I18nProvider>
  );
}
