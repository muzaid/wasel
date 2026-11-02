"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/** What the server reports on each heartbeat (migration 004): explains why offers do or do not arrive. */
export interface CourierStatus {
  new_offers: number; online: boolean; verification: string; blocked: boolean; busy: boolean; has_location: boolean;
  waiting_nearby: number; waiting_too_big: number; max_radius_km: number; at: number;
}
interface CourierCtx { online: boolean; setOnline: (v: boolean) => Promise<void>; pos: { lat: number; lng: number } | null; geoError: string; status: CourierStatus | null }
const Ctx = createContext<CourierCtx>({ online: false, setOnline: async () => {}, pos: null, geoError: "", status: null });
export const useCourier = () => useContext(Ctx);

/** Keeps streaming GPS to the backend while the courier is online (or on an active job), across all courier pages. */
export default function CourierProvider({ children }: { children: React.ReactNode }) {
  const { courier, session, refresh } = useAuth();
  const [online, setOnlineState] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
  const [status, setStatus] = useState<CourierStatus | null>(null);
  const last = useRef<{ lat: number; lng: number; heading: number | null; sent: number } | null>(null);

  useEffect(() => { if (courier) setOnlineState(courier.is_online); }, [courier]);

  const send = useCallback((lat: number, lng: number, heading: number | null, force = false) => {
    const now = Date.now();
    if (!force && last.current && now - last.current.sent < 4000) return;
    last.current = { lat, lng, heading, sent: now };
    supabase.rpc("update_location", { p_lat: lat, p_lng: lng, p_heading: heading });
  }, []);

  useEffect(() => {
    if (!online || !session || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => { setGeoError(""); setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); send(p.coords.latitude, p.coords.longitude, p.coords.heading); },
      (e) => setGeoError(e.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [online, session, send]);

  // Heartbeat every 20 s, with or without a GPS fix: keeps the courier "seen", widens waiting searches and
  // picks up deliveries that were posted before the courier came online (wasel_courier_heartbeat, migration 004).
  useEffect(() => {
    if (!online || !session) { setStatus(null); return; }
    let alive = true;
    const beat = () => supabase.rpc("courier_heartbeat", { p_lat: last.current?.lat ?? null, p_lng: last.current?.lng ?? null })
      .then(({ data, error }) => {
        if (error) { // migration 004 not installed yet: fall back to the old location heartbeat
          if (last.current) send(last.current.lat, last.current.lng, last.current.heading, true);
          return;
        }
        if (alive && data) setStatus({ ...(data as Omit<CourierStatus, "at">), at: Date.now() });
      });
    beat();
    const hb = setInterval(beat, 20000);
    const vis = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearInterval(hb); document.removeEventListener("visibilitychange", vis); };
  }, [online, session, send]);

  const setOnline = async (v: boolean) => {
    if (!session) return;
    setOnlineState(v);
    await supabase.from("couriers").update({ is_online: v }).eq("id", session.user.id);
    if (v && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
    await refresh();
  };

  return <Ctx.Provider value={{ online, setOnline, pos, geoError, status }}>{children}</Ctx.Provider>;
}
