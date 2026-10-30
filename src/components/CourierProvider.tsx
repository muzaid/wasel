"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface CourierCtx { online: boolean; setOnline: (v: boolean) => Promise<void>; pos: { lat: number; lng: number } | null; geoError: string }
const Ctx = createContext<CourierCtx>({ online: false, setOnline: async () => {}, pos: null, geoError: "" });
export const useCourier = () => useContext(Ctx);

/** Keeps streaming GPS to the backend while the courier is online (or on an active job), across all courier pages. */
export default function CourierProvider({ children }: { children: React.ReactNode }) {
  const { courier, session, refresh } = useAuth();
  const [online, setOnlineState] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
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
    // heartbeat keeps last_seen fresh even when standing still
    const hb = setInterval(() => { if (last.current) send(last.current.lat, last.current.lng, last.current.heading, true); }, 30000);
    return () => { navigator.geolocation.clearWatch(id); clearInterval(hb); };
  }, [online, session, send]);

  const setOnline = async (v: boolean) => {
    if (!session) return;
    setOnlineState(v);
    await supabase.from("couriers").update({ is_online: v }).eq("id", session.user.id);
    if (v && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
    await refresh();
  };

  return <Ctx.Provider value={{ online, setOnline, pos, geoError }}>{children}</Ctx.Provider>;
}
