"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LayoutDashboard, LogOut, PackagePlus, Settings, Users, Wallet, UserRound, Truck, Package, Bike, Home } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import type { Notification, Role } from "@/lib/types";
import { Avatar, LangSwitch, Logo } from "./ui";
import RoleSwitcher from "./RoleSwitcher";
import { useTm, MKey } from "@/lib/i18n-marketplace";

type NavItem = { href: string; label: TKey | `m:${MKey}`; icon: ReactNode };
const NAV: Record<Role, NavItem[]> = {
  customer: [
    { href: "/customer", label: "dashboard", icon: <Home className="h-5 w-5" /> },
    { href: "/customer/new", label: "m:send_package", icon: <PackagePlus className="h-5 w-5" /> },
    { href: "/customer/history", label: "history", icon: <Package className="h-5 w-5" /> },
    { href: "/customer/profile", label: "profile", icon: <UserRound className="h-5 w-5" /> },
  ],
  business: [
    { href: "/business", label: "dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: "/business/new", label: "new_shipment", icon: <PackagePlus className="h-5 w-5" /> },
    { href: "/business/history", label: "history", icon: <Package className="h-5 w-5" /> },
    { href: "/business/team", label: "m:team", icon: <Users className="h-5 w-5" /> },
    { href: "/business/profile", label: "profile", icon: <UserRound className="h-5 w-5" /> },
  ],
  courier: [
    { href: "/courier", label: "dashboard", icon: <Bike className="h-5 w-5" /> },
    { href: "/courier/earnings", label: "earnings", icon: <Wallet className="h-5 w-5" /> },
    { href: "/courier/profile", label: "profile", icon: <UserRound className="h-5 w-5" /> },
  ],
  admin: [
    { href: "/admin", label: "dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: "/admin/shipments", label: "shipments", icon: <Package className="h-5 w-5" /> },
    { href: "/admin/couriers", label: "couriers", icon: <Truck className="h-5 w-5" /> },
    { href: "/admin/users", label: "users", icon: <Users className="h-5 w-5" /> },
    { href: "/admin/finance", label: "finance", icon: <Wallet className="h-5 w-5" /> },
    { href: "/admin/settings", label: "settings", icon: <Settings className="h-5 w-5" /> },
  ],
};

export function notifTitle(title: string, t: (k: TKey) => string) {
  if (title === "new_offer") return t("new_offer");
  if (title === "courier_assigned") return t("st_accepted");
  if (title.startsWith("status_")) return t(("st_" + title.slice(7)) as TKey);
  if (title.endsWith("_cancelled")) return t("st_cancelled");
  if (title.startsWith("verification_")) return `${t("verification")}: ${t(title.slice(13) as TKey)}`;
  return title;
}

/** Marketplace notification titles (business invites, B2B incoming updates). */
function useNotifTitle() {
  const { t } = useI18n();
  const { tm } = useTm();
  return (title: string) => (["business_invite", "incoming_picked_up", "incoming_delivered"].includes(title) ? tm(title as MKey) : notifTitle(title, t));
}

function Bell_() {
  const { session } = useAuth();
  const { lang, t } = useI18n();
  const title = useNotifTitle();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const uid = session?.user.id;

  useEffect(() => {
    if (!uid) return;
    const fetchAll = () => supabase.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setItems((data as Notification[]) ?? []));
    fetchAll();
    const poll = setInterval(() => { if (!document.hidden) fetchAll(); }, 15000); // fallback if Realtime drops
    const ch = supabase.channel("notif-" + uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (p) => setItems((x) => [p.new as Notification, ...x.filter((i) => i.id !== (p.new as Notification).id)].slice(0, 20)))
      .subscribe();
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [uid]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const unread = items.filter((i) => !i.is_read).length;
  const openPanel = async () => {
    setOpen(!open);
    if (!open && unread && uid) {
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", uid).eq("is_read", false);
      setItems((x) => x.map((i) => ({ ...i, is_read: true })));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={openPanel} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100" aria-label={t("notifications")}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute end-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute end-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b px-4 py-3 text-sm font-bold">{t("notifications")}</div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <div className="p-6 text-center text-sm text-slate-400">{t("no_notifications")}</div>}
            {items.map((n) => (
              <button key={n.id} onClick={() => { setOpen(false); if (n.link) router.push(n.link); }}
                className="block w-full border-b border-slate-100 px-4 py-3 text-start hover:bg-slate-50">
                <div className="text-sm font-semibold">{title(n.title)}</div>
                {n.body && <div className="truncate text-xs text-slate-500">{n.body}</div>}
                <div className="mt-0.5 text-[11px] text-slate-400">{new Date(n.created_at).toLocaleString(lang === "en" ? "en-GB" : lang)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { profile, business, activeRole, signOut } = useAuth();
  const { t } = useI18n();
  const { tm } = useTm();
  const label = (l: NavItem["label"]) => (l.startsWith("m:") ? tm(l.slice(2) as MKey) : t(l as TKey));
  const path = usePathname();
  const router = useRouter();
  const nav = activeRole ? NAV[activeRole] : [];
  const isActive = (h: string) => (["/business", "/courier", "/admin", "/customer"].includes(h) ? path === h : path.startsWith(h));

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className={`mx-auto flex h-16 items-center gap-4 px-4 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
          <Link href="/"><Logo /></Link>
          {activeRole && <span className="chip hidden bg-slate-100 text-slate-600 lg:inline-flex">{tm(`role_${activeRole}` as MKey)}</span>}
          <nav className="ms-4 hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link key={n.href} href={n.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive(n.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
                {label(n.label)}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <RoleSwitcher />
            <LangSwitch />
            {profile && <Bell_ />}
            {profile && (
              <Link href={activeRole === "admin" ? "/admin" : `/${activeRole}/profile`} className="ms-1" title={profile.full_name}>
                {activeRole === "business" && business?.logo_url
                  ? <Avatar src={business.logo_url} name={business.business_name} size={34} square />
                  : <Avatar src={profile.avatar_url} name={profile.full_name} size={34} />}
              </Link>
            )}
            {profile && (
              <button onClick={async () => { await signOut(); router.replace("/"); }} className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100" title={t("logout")}>
                <LogOut className="h-5 w-5 rtl:rotate-180" />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>{children}</main>
      {nav.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
          style={{ gridTemplateColumns: `repeat(${Math.min(nav.length, 5)}, 1fr)` }}>
          {nav.slice(0, 5).map((n) => (
            <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive(n.href) ? "text-brand-600" : "text-slate-500"}`}>
              {n.icon}{label(n.label)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
