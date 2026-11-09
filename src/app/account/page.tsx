"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, BadgePercent, Bike, Building2, ChartLine, FileText, HandCoins, Headphones, Inbox, Info, LifeBuoy, List, LogOut,
  MapPin, Package, PackagePlus, Phone, ReceiptText, Settings, Star, Tag, UserRound, Users, Wallet,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Avatar, Spinner } from "@/components/ui";
import { Row, Tile } from "@/components/support";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { useTs } from "@/lib/i18n-support";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/geo";

const ic = "h-[22px] w-[22px]";
const startOfMonth = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString(); };
const startOfWeek = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d.toISOString(); };

/** "My account": one menu per role with the actions that person needs. */
export default function AccountPage() {
  const { session, profile, business, courier, activeRole, loading, signOut } = useAuth();
  const { t } = useI18n();
  const { tm } = useTm();
  const { ts } = useTs();
  const router = useRouter();
  const uid = session?.user.id;
  const [credit, setCredit] = useState(0);
  const [coupons, setCoupons] = useState(0);
  const [pendingRefunds, setPendingRefunds] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const [biz, setBiz] = useState({ count: 0, spent: 0, saved: 0, incoming: 0 });
  const [cour, setCour] = useState({ week: 0, trips: 0 });
  const [adm, setAdm] = useState({ refunds: 0, tickets: 0 });

  useEffect(() => { if (!loading && !session) router.replace("/login?next=/account"); }, [loading, session, router]);

  useEffect(() => {
    if (!uid) return;
    supabase.from("wallets").select("balance").eq("user_id", uid).maybeSingle().then(({ data }) => setCredit(Number(data?.balance ?? 0)));
    supabase.rpc("my_coupons").then(({ data }) => setCoupons(((data as unknown[]) ?? []).length));
    supabase.from("refunds").select("id", { count: "exact", head: true }).eq("requester_id", uid).eq("status", "pending").then(({ count }) => setPendingRefunds(count ?? 0));
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "answered").then(({ count }) => setOpenTickets(count ?? 0));
  }, [uid]);

  useEffect(() => {
    if (activeRole === "business" && business) {
      supabase.from("shipments").select("price,discount_amount,status").eq("business_id", business.id).gte("created_at", startOfMonth())
        .then(({ data }) => {
          const rows = (data ?? []).filter((r) => !["cancelled", "expired"].includes(r.status));
          setBiz((b) => ({ ...b, count: rows.length, spent: rows.reduce((s, r) => s + Number(r.price) - Number(r.discount_amount ?? 0), 0) }));
        });
      supabase.from("ledger").select("amount").eq("kind", "discount").eq("business_id", business.id)
        .then(({ data }) => setBiz((b) => ({ ...b, saved: (data ?? []).reduce((s, r) => s + Number(r.amount), 0) })));
      supabase.from("shipments").select("id", { count: "exact", head: true }).eq("recipient_business_id", business.id)
        .in("status", ["searching", "accepted", "arrived_pickup", "picked_up", "in_transit"]).then(({ count }) => setBiz((b) => ({ ...b, incoming: count ?? 0 })));
    }
    if (activeRole === "courier" && uid) {
      supabase.from("ledger").select("amount").eq("courier_id", uid).eq("kind", "courier_earning").gte("created_at", startOfWeek())
        .then(({ data }) => setCour({ week: (data ?? []).reduce((s, r) => s + Number(r.amount), 0), trips: data?.length ?? 0 }));
    }
    if (activeRole === "admin") {
      supabase.from("refunds").select("id", { count: "exact", head: true }).eq("status", "pending").then(({ count }) => setAdm((a) => ({ ...a, refunds: count ?? 0 })));
      supabase.from("tickets").select("id", { count: "exact", head: true }).neq("status", "solved").then(({ count }) => setAdm((a) => ({ ...a, tickets: count ?? 0 })));
    }
  }, [activeRole, business, uid]);

  if (!profile || !activeRole) return <AppShell><Spinner /></AppShell>;
  const logout = async () => { await signOut(); router.replace("/"); };
  const common = (
    <>
      <Row href="/help" icon={<LifeBuoy className="h-5 w-5" />} label={ts("help_desk")} />
      <Row href="/about" icon={<Info className="h-5 w-5" />} label={ts("about_us")} />
      <Row href="/contact" icon={<Phone className="h-5 w-5" />} label={ts("contact_us")} />
      <Row onClick={logout} icon={<LogOut className="h-5 w-5 rtl:rotate-180" />} label={ts("logout")} danger />
    </>
  );

  const head = (avatar: React.ReactNode, sub: string, name: string, chip: React.ReactNode) => (
    <div className="mb-4 flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1"><div className="text-sm text-ink-500">{sub}</div><h1 className="truncate text-2xl font-extrabold">{name}</h1></div>
      {chip}
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4">
        {activeRole === "customer" && (
          <>
            {head(<Avatar src={profile.avatar_url} name={profile.full_name} size={56} />, ts("personal_account"), `${ts("hi")}, ${profile.full_name.split(" ")[0]}`,
              <span className="chip bg-brand-50 text-brand-700">{tm("role_customer")}</span>)}
            <div className="flex items-center gap-4 rounded-3xl bg-brand-600 p-5 text-white">
              <div className="flex-1">
                <div className="text-sm font-semibold opacity-85">{ts("wasel_credit")}</div>
                <div className="text-3xl font-extrabold tabular-nums">{money(credit)}</div>
                <div className="text-sm opacity-85">{coupons} {ts("coupons_ready")}</div>
              </div>
              <a href="/coupons" className="btn bg-sun-400 px-4 py-2.5 text-ink-900">{ts("coupons")}</a>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <Tile href="/customer/new" icon={<PackagePlus className={ic} />} label={tm("send_package")} tone="green" />
              <Tile href="/customer/history" icon={<List className={ic} />} label={tm("my_deliveries")} tone="sky" />
              <Tile href="/refunds" icon={<HandCoins className={ic} />} label={ts("refunds")} tone="peach" badge={pendingRefunds} />
              <Tile href="/coupons" icon={<Tag className={ic} />} label={ts("coupons")} tone="sun" badge={coupons} />
              <Tile href="/customer/profile" icon={<MapPin className={ic} />} label={ts("profile_settings")} tone="violet" />
              <Tile href="/help" icon={<Headphones className={ic} />} label={ts("help_desk")} tone="grey" badge={openTickets} />
            </div>
            <div className="card overflow-hidden">
              <Row href="/customer/profile" icon={<UserRound className="h-5 w-5" />} label={ts("profile_settings")} />
              {common}
            </div>
          </>
        )}

        {activeRole === "business" && business && (
          <>
            {head(<Avatar src={business.logo_url} name={business.business_name} size={56} square />, `${tm("role_business")}`, business.business_name,
              business.verification === "approved" ? <span className="chip bg-brand-50 text-brand-700">✓</span> : null)}
            <div className="card grid grid-cols-3 gap-2 p-4 text-center">
              <div><div className="text-2xl font-extrabold tabular-nums">{biz.count}</div><div className="text-xs text-ink-500">{ts("this_month")}</div></div>
              <div><div className="text-2xl font-extrabold tabular-nums">{money(biz.spent)}</div><div className="text-xs text-ink-500">{ts("spent")}</div></div>
              <div><div className="text-2xl font-extrabold tabular-nums text-sun-700">{money(biz.saved)}</div><div className="text-xs text-ink-500">{ts("saved_codes")}</div></div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <Tile href="/business/new" icon={<PackagePlus className={ic} />} label={t("new_shipment")} tone="green" />
              <Tile href="/business/history" icon={<List className={ic} />} label={t("history")} tone="sky" />
              <Tile href="/business/team" icon={<Users className={ic} />} label={tm("team")} tone="violet" />
              <Tile href="/business/coupons" icon={<BadgePercent className={ic} />} label={ts("discount_codes")} tone="sun" />
              <Tile href="/refunds" icon={<HandCoins className={ic} />} label={ts("refunds")} tone="peach" badge={pendingRefunds} />
              <Tile href="/business" icon={<Inbox className={ic} />} label={tm("incoming")} tone="green" badge={biz.incoming} />
              <Tile href="/business/history" icon={<ChartLine className={ic} />} label={t("dashboard")} tone="sky" />
              <Tile href="/business/profile" icon={<Building2 className={ic} />} label={t("profile")} tone="grey" />
              <Tile href="/help" icon={<Headphones className={ic} />} label={ts("help_desk")} tone="grey" badge={openTickets} />
            </div>
            <div className="card overflow-hidden">
              <Row href="/business/profile" icon={<Settings className="h-5 w-5" />} label={ts("profile_settings")} />
              {common}
            </div>
          </>
        )}

        {activeRole === "courier" && (
          <>
            {head(<Avatar src={profile.avatar_url} name={profile.full_name} size={56} />, `${tm("role_courier")} · ★ ${Number(courier?.rating_avg ?? 0).toFixed(1)}`, profile.full_name,
              <span className={`chip ${courier?.is_online ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-700"}`}>{courier?.is_online ? t("you_are_online") : t("you_are_offline")}</span>)}
            <div className="card flex items-center gap-4 p-5">
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink-500">{ts("this_week")}</div>
                <div className="text-3xl font-extrabold tabular-nums">{money(cour.week)}</div>
                <div className="text-sm text-ink-500">{cour.trips} {ts("trips")}</div>
              </div>
              <a href="/help?new=payout" className="btn-primary">{ts("request_payout")}</a>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <Tile href="/courier" icon={<Bike className={ic} />} label={ts("jobs_map")} tone="green" />
              <Tile href="/courier/earnings" icon={<Wallet className={ic} />} label={t("earnings")} tone="sky" />
              <Tile href="/courier/profile" icon={<FileText className={ic} />} label={ts("documents_vehicle")} tone="violet" />
              <Tile href="/courier/earnings" icon={<Star className={ic} />} label={t("rating")} tone="sun" />
              <Tile href="/help?new=courier" icon={<AlertTriangle className={ic} />} label={ts("report_problem")} tone="peach" />
              <Tile href="/help" icon={<Headphones className={ic} />} label={ts("help_desk")} tone="grey" badge={openTickets} />
            </div>
            <div className="card overflow-hidden">
              <Row href="/courier/profile" icon={<UserRound className="h-5 w-5" />} label={ts("profile_settings")} />
              {common}
            </div>
          </>
        )}

        {activeRole === "admin" && (
          <>
            {head(<Avatar src={profile.avatar_url} name={profile.full_name} size={56} />, ts("admin_account"), profile.full_name, null)}
            <div className="grid grid-cols-3 gap-2.5">
              <Tile href="/admin/refunds" icon={<HandCoins className={ic} />} label={ts("refund_requests")} tone="peach" badge={adm.refunds} />
              <Tile href="/admin/tickets" icon={<Headphones className={ic} />} label={ts("tickets")} tone="sun" badge={adm.tickets} />
              <Tile href="/admin/coupons" icon={<BadgePercent className={ic} />} label={ts("coupons")} tone="green" />
              <Tile href="/admin/shipments" icon={<Package className={ic} />} label={t("shipments")} tone="sky" />
              <Tile href="/admin/finance" icon={<ReceiptText className={ic} />} label={t("finance")} tone="violet" />
              <Tile href="/admin/settings" icon={<Settings className={ic} />} label={t("settings")} tone="grey" />
            </div>
            <div className="card overflow-hidden">{common}</div>
          </>
        )}
      </div>
    </AppShell>
  );
}
