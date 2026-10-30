"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";
import type { Business, Courier, Profile, Role } from "./types";

interface AuthState {
  session: Session | null; profile: Profile | null; courier: Courier | null; business: Business | null;
  loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) { setProfile(null); setCourier(null); setBusiness(null); setLoading(false); return; }
    const { data: p } = await supabase.from("profiles").select("*").eq("id", s.user.id).single();
    setProfile(p as Profile);
    if (p?.role === "courier") {
      const { data } = await supabase.from("couriers").select("*").eq("id", s.user.id).single();
      setCourier(data as Courier);
    } else if (p?.role === "business") {
      const { data } = await supabase.from("businesses").select("*").eq("id", s.user.id).single();
      setBusiness(data as Business);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => load(s));
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => { const { data } = await supabase.auth.getSession(); await load(data.session); }, [load]);
  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  return <Ctx.Provider value={{ session, profile, courier, business, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export const homeFor = (r?: Role) => (r === "admin" ? "/admin" : r === "courier" ? "/courier" : "/business");

/** Redirects away unless signed in with the given role. Returns true when allowed. */
export function useRequireRole(role: Role) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (profile && profile.role !== role) router.replace(homeFor(profile.role));
  }, [loading, session, profile, role, router]);
  return !loading && !!profile && profile.role === role;
}
