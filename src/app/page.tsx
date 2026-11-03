"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Banknote, KeyRound, MapPin, Radar, ShieldCheck, Tag } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="pointer-events-none absolute -top-40 start-1/3 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Logo light />
          <div className="flex items-center gap-2">
            <LangSwitch dark />
            <Link href="/login" className="btn text-white hover:bg-white/10">{t("login")}</Link>
          </div>
        </header>
        <div className="relative mx-auto max-w-7xl px-4 pb-28 pt-4 md:pt-8">
          <span className="chip mb-4 bg-white/10 text-brand-400">₪ · Israel · {t("live")}</span>
          <h1 className="max-w-3xl text-3xl font-extrabold leading-tight md:text-4xl">{t("tagline")}</h1>
          <p className="mt-3 max-w-2xl text-slate-300">{t("hero_sub")}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/signup?role=business" className="btn bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">{t("for_business")}</Link>
            <Link href="/signup?role=courier" className="btn bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">{t("for_courier")}</Link>
          </div>
        </div>
      </section>

      {/* The map and the delivery form, right on the home page: route, nearest couriers, prices */}
      <section className="relative mx-auto -mt-20 max-w-7xl px-4">
        <div className="rounded-3xl bg-slate-50 p-3 shadow-2xl ring-1 ring-slate-200 md:p-6">
          <div className="mb-4 flex items-center gap-3 px-1">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500 text-2xl">📦</div>
            <div>
              <h2 className="text-xl font-extrabold">{tm("send_package")}</h2>
              <p className="text-sm text-slate-500">{tm("choose_courier_hint")}</p>
            </div>
          </div>
          <DeliveryForm mode="customer" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="mb-10 text-center text-3xl font-extrabold">{tm("three_ways")}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {([["b2c", "🏪 → 🏠"], ["c2c", "🙋 → 🙋"], ["b2b", "🏭 → 🏪"]] as const).map(([k, icon]) => (
            <div key={k} className="card p-6">
              <div className="mb-3 flex items-center justify-between"><span className="chip bg-ink-900 text-white">{tm(`type_${k}`)}</span><span dir="ltr" className="text-2xl">{icon}</span></div>
              <div className="font-bold">{tm(`type_${k}_long`)}</div>
              <p className="mt-1 text-sm text-slate-500">{tm(`${k}_desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="mb-10 text-center text-3xl font-extrabold">{t("how_it_works")}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {(["h1", "h2", "h3"] as const).map((k, i) => (
            <div key={k} className="card p-6">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-ink-900 font-bold text-white">{i + 1}</div>
              <div className="text-lg font-bold">{t(k)}</div>
              <p className="mt-1 text-slate-500">{t(`${k}d` as TKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([a, b, ic]) => (
            <div key={a} className="card p-6">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">{ic}</div>
              <div className="font-bold">{t(a)}</div>
              <p className="mt-1 text-sm text-slate-500">{t(b)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-6 rounded-[2rem] bg-brand-600 p-10 text-white md:grid-cols-2 md:items-center">
          <div>
            <h3 className="text-3xl font-extrabold">{t("become_courier")}</h3>
            <p className="mt-2 text-brand-100">{t("f1d")}</p>
          </div>
          <div className="flex gap-3 md:justify-end">
            <Link href="/signup?role=courier" className="btn bg-white px-6 py-3.5 text-ink-900">{t("for_courier")}</Link>
            <Link href="/signup?role=business" className="btn bg-ink-900 px-6 py-3.5 text-white">{t("start_now")}</Link>
          </div>
        </div>
      </section>
      <footer className="border-t py-8 text-center text-sm text-slate-400">© {new Date().getFullYear()} {t("app")}</footer>
    </div>
  );
}
