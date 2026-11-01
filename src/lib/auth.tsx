"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase, T } from "./supabase";
import type { Business, Courier, Membership, Profile, Role } from "./types";

/**
 * Unified identity: one Supabase user can hold several roles (customer, courier, business member, admin).
 * `activeRole` decides which app the user is looking at; `business` is the business they are acting for.
 */
interface AuthState {
  session: Session | null; profile: Profile | null; roles: Role[]; activeRole: Role | null;
  courier: Courier | null; memberships: Membership[]; membership: Membership | null; business: Business | null;
  loading: boolean;
  setActiveRole: (r: Role) => void; setActiveBusiness: (id: string) => void;
  refresh: () => Promise<void>; signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState>({} as AuthState);

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeRole, setActiveRoleState] = useState<Role | null>(null);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) { setProfile(null); setRoles([]); setCourier(null); setMemberships([]); setActiveRoleState(null); setLoading(false); return; }
    const uid = s.user.id;
    const [{ data: p }, { data: r }, { data: m }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("business_members").select(`business_id, member_role, business:${T("businesses")}(*)`).eq("user_id", uid),
    ]);
    const prof = p as Profile | null;
    // Before migration 003 the roles table does not exist: fall back to the single profile role
    let rs = ((r as { role: Role }[] | null) ?? []).map((x) => x.role);
    if (!rs.length && prof) rs = [prof.role];
    let ms = ((m as unknown as Membership[] | null) ?? []).filter((x) => x.business);
    if (!ms.length && rs.includes("business")) {
      const { data: legacy } = await supabase.from("businesses").select("*").eq("id", uid).maybeSingle();
      if (legacy) ms = [{ business_id: uid, member_role: "owner", business: legacy as Business }];
    }
    let c: Courier | null = null;
    if (rs.includes("courier")) {
      const { data } = await supabase.from("couriers").select("*").eq("id", uid).maybeSingle();
      c = data as Courier | null;
    }
    const saved = store.get("wasel_role") as Role | null;
    const role = saved && rs.includes(saved) ? saved : prof && rs.includes(prof.role) ? prof.role : rs[0] ?? null;
    const savedBiz = store.get("wasel_business");
    setProfile(prof); setRoles(rs); setCourier(c); setMemberships(ms); setActiveRoleState(role);
    setActiveBusinessId(ms.find((x) => x.business_id === savedBiz)?.business_id ?? ms[0]?.business_id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => load(s));
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const setActiveRole = useCallback((r: Role) => { store.set("wasel_role", r); setActiveRoleState(r); }, []);
  const setActiveBusiness = useCallback((id: string) => { store.set("wasel_business", id); setActiveBusinessId(id); }, []);
  const refresh = useCallback(async () => { const { data } = await supabase.auth.getSession(); await load(data.session); }, [load]);
  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const membership = memberships.find((m) => m.business_id === activeBusinessId) ?? null;
  return (
    <Ctx.Provider value={{
      session, profile, roles, activeRole, courier, memberships, membership, business: membership?.business ?? null,
      loading, setActiveRole, setActiveBusiness, refresh, signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

export const homeFor = (r?: Role | null) =>
  r === "admin" ? "/admin" : r === "courier" ? "/courier" : r === "business" ? "/business" : "/customer";

/** Guards a section of the app: switches into the role when the user holds it, otherwise redirects. */
export function useRequireRole(role: Role) {
  const { session, roles, activeRole, loading, setActiveRole } = useAuth();
  const router = useRouter();
  const has = roles.includes(role);
  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (!has) router.replace(homeFor(activeRole));
    else if (activeRole !== role) setActiveRole(role);
  }, [loading, session, has, activeRole, role, router, setActiveRole]);
  return !loading && !!session && has;
}
