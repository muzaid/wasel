"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Settings, Shipment, ShipmentEvent } from "./types";

export function useSettings() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => { supabase.from("settings").select("*").eq("id", 1).single().then(({ data }) => setS(data as Settings)); }, []);
  return s;
}

/** Live shipment + events + assigned courier position via Supabase Realtime. */
export function useLiveShipment(id: string) {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<ShipmentEvent[]>([]);
  const [courierPos, setCourierPos] = useState<{ lat: number; lng: number } | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [offers, setOffers] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: sh }, { data: ev }, { count }] = await Promise.all([
      supabase.from("shipments").select("*").eq("id", id).single(),
      supabase.from("shipment_events").select("*").eq("shipment_id", id).order("created_at"),
      supabase.from("shipment_offers").select("id", { count: "exact", head: true }).eq("shipment_id", id),
    ]);
    setShipment(sh as Shipment); setEvents((ev as ShipmentEvent[]) ?? []); setOffers(count ?? 0); setLoading(false);
    const { data: locs } = await supabase.from("courier_locations").select("lat,lng").eq("shipment_id", id).order("created_at").limit(500);
    if (locs?.length) { setTrail(locs.map((l) => [l.lat, l.lng])); setCourierPos(locs[locs.length - 1]); }
  }, [id]);

  useEffect(() => {
    load();
    const ch = supabase.channel("ship-" + id)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shipments", filter: `id=eq.${id}` }, (p) => setShipment(p.new as Shipment))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shipment_events", filter: `shipment_id=eq.${id}` }, (p) => setEvents((e) => [...e, p.new as ShipmentEvent]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shipment_offers", filter: `shipment_id=eq.${id}` }, () => setOffers((n) => n + 1))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "courier_locations", filter: `shipment_id=eq.${id}` }, (p) => {
        const l = p.new as { lat: number; lng: number };
        setCourierPos({ lat: l.lat, lng: l.lng }); setTrail((t) => [...t, [l.lat, l.lng]]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  return { shipment, events, courierPos, trail, offers, loading, reload: load };
}

export function beep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [0, 0.25, 0.5].forEach((d) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.2);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

export function errKey(msg: string) {
  for (const k of ["already_taken", "busy", "bad_otp", "no_offer", "cannot_cancel", "forbidden", "invalid_transition"]) if (msg.includes(k)) return k;
  return "error";
}
