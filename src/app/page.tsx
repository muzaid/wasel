"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, KeyRound, MapPin, Radar, ShieldCheck, Store, Tag, Truck, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CENTER } from "@/lib/geo";
import { useI18n, TKey } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { useAuth, homeFor } from "@/lib/auth";
import { LangSwitch, Logo } from "@/components/ui";
import DeliveryForm from "@/components/DeliveryForm";

const features: [TKey, TKey, React.ReactNode][] = [
  ["f1", "f1d", <Radar key="1" className="h-5 w-5" />],
  ["f2", "f2d", <MapPin key="2" className="h-5 w-5" />],
  ["f3", "f3d", <Tag key="3" className="h-5 w-5" />],
  ["f4", "f4d", <KeyRound key="4" className="h-5 w-5" />],
  ["f5", "f5d", <Banknote key="5" className="h-5 w-5" />],
  ["f6", "f6d", <ShieldCheck key="6" className="h-5 w-5" />],
];

export default function Home() {
  const { t } = useI18n();
  const { tm } = useTm();
  const { profile } = useAuth();
  const router = useRouter();
  useEffect(() => { if (profile) router.replace(homeFor(profile.role)); }, [profile, router]);

  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    supabase.rpc("nearby_couriers", { p_lat: DEFAULT_CENTER.lat, p_lng: DEFAULT_CENTER.lng, p_vehicle: "bike", p_limit: 10 })
      .then(({ data }) => setOnline(((data as unknown[]) ?? []).length));
  }, []);

  const ways = [
    ["c2c", "bg-brand-50", "text-brand-600", <Users key="c" className="h-7 w-7" />],
    ["b2c", "bg-sun-50", "text-sun-700", <Store key="s" className="h-7 w-7" />],
    ["b2b", "bg-sky2-50", "text-sky2-700", <Truck key="t" className="h-7 w-7" />],
  ] as const;
  const steps = [["h1", "bg-brand-600 text-white"], ["h2", "bg-sun-400 text-ink-900"], ["h3", "bg-ink-900 text-white"]] as const;

  return (
    <div className="min-h-screen bg-mint">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-5">
        <Logo size={40} />
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/send" className="rounded-full bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700">{tm("send_package")}</Link>
          <Link href="/signup?role=business" className="rounded-full px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-white">{t("for_business")}</Link>
          <Link href="/signup?role=courier" className="rounded-full px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-white">{t("for_courier")}</Link>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LangSwitch />
          <Link href="/login" className="btn hidden px-4 text-ink-900 hover:bg-white sm:inline-flex">{t("login")}</Link>
          <Link href="/signup" className="btn-dark">{t("signup")}</Link>
        </div>
      </header>

      {/* Friendly greeting, then the map and the delivery form right on the home page */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-4">
        <div className="mb-6 max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-ink-700 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 ring-4 ring-green-100" />
            {online ? `${online} · ${tm("couriers_near_you")}` : tm("couriers_near_you")}
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">{tm("hero_hi")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-500 md:text-xl">{tm("hero_hi_sub")}</p>
        </div>
        <div className="rounded-[2rem] bg-white p-3 shadow-[0_12px_32px_rgba(23,38,46,.08)] md:p-6">
          <DeliveryForm mode="customer" />
          <p className="mt-4 text-center text-sm text-ink-500">{tm("no_account_needed")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-3xl font-extrabold">{tm("three_ways")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {ways.map(([k, bg, fg, icon]) => (
            <div key={k} className={`rounded-[28px] p-7 ${bg}`}>
              <div className={`mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-white ${fg}`}>{icon}</div>
              <div className="text-xl font-bold">{tm(`type_${k}_friendly`)}</div>
              <p className="mt-2 text-ink-700">{tm(`${k}_desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-[36px] bg-white p-8 shadow-sm md:p-10">
          <h2 className="mb-8 text-center text-3xl font-extrabold">{tm("easy_steps")}</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map(([k, cls], i) => (
              <div key={k} className="flex flex-col items-center text-center">
                <div className={`mb-3 grid h-16 w-16 place-items-center rounded-full text-2xl font-extrabold ${cls}`}>{i + 1}</div>
                <div className="text-lg font-bold">{t(k)}</div>
                <p className="mt-1 text-ink-500">{t(`${k}d` as TKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([a, b, ic]) => (
            <div key={a} className="card p-6">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{ic}</div>
              <div className="font-bold">{t(a)}</div>
              <p className="mt-1 text-sm text-ink-500">{t(b)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[36px] bg-sun-400 p-8 md:p-10">
          <div className="max-w-2xl">
            <h3 className="text-3xl font-extrabold">{tm("courier_cta_title")}</h3>
            <p className="mt-2 text-lg text-[#3B2E00]">{tm("courier_cta_sub")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup?role=courier" className="btn-dark px-7 py-4 text-base">{t("for_courier")}</Link>
            <Link href="/signup?role=business" className="btn bg-white px-7 py-4 text-base text-ink-900">{t("for_business")}</Link>
          </div>
        </div>
      </section>
      <footer className="border-t border-[#E1EAE6] py-8 text-center text-sm text-ink-500">© {new Date().getFullYear()} {t("app")} · Tel Aviv · Jerusalem · Haifa</footer>
    </div>
  );
}
