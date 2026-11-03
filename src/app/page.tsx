"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Banknote, KeyRound, MapPin, Radar, ShieldCheck, Tag } from "lucide-react";
import { useI18n, TKey } from "@/lib/i18n";
import { useTm } from "@/lib/i18n-marketplace";
import { useAuth, homeFor } from "@/lib/auth";
import { LangSwitch, Logo } from "@/components/ui";

const features: [TKey, TKey, React.ReactNode][] = [
  ["f1", "f1d", <Radar key="1" className="h-5 w-5" />],
  ["f2", "f2d", <MapPin key="2" className="h-5 w-5" />],
  ["f3", "f3d", <Tag key="3" className="h-5 w-5" />],
  ["f4", "f4d", <KeyRound key="4" className="h-5 w-5" />],
  ["f5", "f5d", <Banknote key="5" className="h-5 w-5" />],
  ["f6", "f6d", <ShieldCheck key="6" className="h-5 w-5" />],
];

function RadarArt() {
  const dots = [[22, 30, "🛵"], [70, 24, "🚗"], [78, 66, "🛵"], [30, 74, "🚲"], [55, 82, "🚐"]] as const;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[2rem] bg-[#0f1b33] ring-1 ring-white/10">
      <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        {Array.from({ length: 10 }).map((_, i) => (
          <g key={i}><line x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="#334155" strokeWidth=".3" /><line x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#334155" strokeWidth=".3" /></g>
        ))}
        <path d="M0 60 Q30 50 50 52 T100 40" stroke="#475569" strokeWidth="1.6" fill="none" />
        <path d="M45 0 Q48 40 50 52 T60 100" stroke="#475569" strokeWidth="1.6" fill="none" />
      </svg>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {[0, 0.8, 1.6].map((d) => (
          <span key={d} className="absolute left-1/2 top-1/2 h-40 w-40 animate-pingc rounded-full border-2 border-brand-400" style={{ animationDelay: `${d}s` }} />
        ))}
        <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-2xl shadow-lg shadow-brand-500/40">📦</div>
      </div>
      {dots.map(([x, y, e], i) => (
        <div key={i} className="absolute grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-ink-900 text-lg shadow-lg" style={{ left: `${x}%`, top: `${y}%` }}>{e}</div>
      ))}
      <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-xl">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-xl">🛵</div>
        <div className="flex-1 text-sm"><div className="font-bold text-ink-900">Ahmad · ★ 4.9</div><div className="text-xs text-slate-500">Yamaha · 12-345-67</div></div>
        <div className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">4 min</div>
      </div>
    </div>
  );
}

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
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Logo light />
          <div className="flex items-center gap-2">
            <LangSwitch dark />
            <Link href="/login" className="btn text-white hover:bg-white/10">{t("login")}</Link>
          </div>
        </header>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-8 md:grid-cols-2 md:pt-16">
          <div>
            <span className="chip mb-5 bg-white/10 text-brand-400">₪ · Israel · {t("live")}</span>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">{t("tagline")}</h1>
            <p className="mt-5 max-w-lg text-lg text-slate-300">{t("hero_sub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/send" className="btn bg-accent px-6 py-3.5 text-base text-ink-900 hover:brightness-95">📦 {tm("send_package")}</Link>
              <Link href="/signup?role=business" className="btn-primary px-6 py-3.5 text-base">{t("for_business")}</Link>
              <Link href="/signup?role=courier" className="btn bg-white px-6 py-3.5 text-base text-ink-900 hover:bg-slate-100">{t("for_courier")}</Link>
            </div>
          </div>
          <RadarArt />
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
