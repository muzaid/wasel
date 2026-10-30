"use client";
import { useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { isConfigured } from "@/lib/supabase";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <I18nProvider>
      <AuthProvider>
        {!isConfigured && (
          <div className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900">
            Supabase is not configured — copy .env.example to .env.local and add your keys (see README).
          </div>
        )}
        {children}
      </AuthProvider>
    </I18nProvider>
  );
}
