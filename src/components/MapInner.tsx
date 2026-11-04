"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { DEFAULT_CENTER } from "@/lib/geo";

export interface MapMarker {
  id: string; lat: number; lng: number;
  kind: "pickup" | "dropoff" | "courier" | "courier_idle" | "me";
  label?: string; popup?: string; emoji?: string;
}
export interface MapProps {
  markers?: MapMarker[];
  line?: [number, number][];
  circle?: { lat: number; lng: number; km: number } | null;
  onPick?: (lat: number, lng: number) => void;
  fitKey?: string;      // change it to re-fit bounds
  follow?: string;      // marker id to keep centered
  className?: string;
  zoom?: number;
}

function icon(m: MapMarker) {
  if (m.kind === "courier" || m.kind === "courier_idle" || m.kind === "me") {
    return L.divIcon({
      className: "", iconSize: [38, 38], iconAnchor: [19, 19],
      html: `<div class="wasel-courier ${m.kind === "courier_idle" ? "idle" : ""}">${m.emoji ?? "🛵"}</div>`,
    });
  }
  const color = m.kind === "pickup" ? "#0B7A57" : "#F0745A";
  return L.divIcon({
    className: "wasel-pin", iconSize: [30, 42], iconAnchor: [15, 38],
    html: `<div style="background:${color}"><span>${m.label ?? (m.kind === "pickup" ? "A" : "B")}</span></div>`,
  });
}

export default function MapInner({ markers = [], line, circle, onPick, fitKey, follow, className, zoom = 13 }: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const live = useRef<Record<string, L.Marker>>({});
  const pickRef = useRef(onPick);
  const hasMarkers = useRef(markers.length > 0);
  hasMarkers.current = markers.length > 0;
  pickRef.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], zoom);
    // Free OpenStreetMap tiles (no API key). Override with NEXT_PUBLIC_MAP_TILES_URL for a paid/high-volume provider.
    L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    // Empty map: start on the user's current location when the browser allows it
    if (!hasMarkers.current && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => { if (map.current === m && !hasMarkers.current) m.setView([p.coords.latitude, p.coords.longitude], zoom); },
        () => { /* denied or unavailable: stay on the default city */ },
        { maximumAge: 300000, timeout: 8000 });
    }
    return () => { m.remove(); map.current = null; live.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // static layers (pins, line, circle)
  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.filter((x) => x.kind === "pickup" || x.kind === "dropoff").forEach((mk) => {
      const mm = L.marker([mk.lat, mk.lng], { icon: icon(mk) });
      if (mk.popup) mm.bindPopup(mk.popup);
      mm.addTo(g);
    });
    if (line && line.length > 1) L.polyline(line, { color: "#0B7A57", weight: 5, opacity: 0.8, dashArray: "1 8", lineCap: "round" }).addTo(g);
    if (circle) L.circle([circle.lat, circle.lng], { radius: circle.km * 1000, color: "#0B7A57", weight: 1, fillOpacity: 0.06 }).addTo(g);
  }, [markers, line, circle]);

  // moving markers (couriers) — animate position instead of re-creating
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const moving = markers.filter((x) => x.kind !== "pickup" && x.kind !== "dropoff");
    const ids = new Set(moving.map((x) => x.id));
    Object.keys(live.current).forEach((id) => { if (!ids.has(id)) { live.current[id].remove(); delete live.current[id]; } });
    moving.forEach((mk) => {
      const ex = live.current[mk.id];
      if (ex) { ex.setLatLng([mk.lat, mk.lng]); ex.setIcon(icon(mk)); }
      else {
        const mm = L.marker([mk.lat, mk.lng], { icon: icon(mk), zIndexOffset: 1000 }).addTo(m);
        if (mk.popup) mm.bindPopup(mk.popup);
        live.current[mk.id] = mm;
      }
    });
    if (follow) { const f = moving.find((x) => x.id === follow); if (f) m.panTo([f.lat, f.lng], { animate: true }); }
  }, [markers, follow]);

  useEffect(() => {
    const m = map.current;
    if (!m || !markers.length) return;
    const pts = markers.map((x) => [x.lat, x.lng] as [number, number]);
    if (pts.length === 1) m.setView(pts[0], Math.max(m.getZoom(), 14));
    else m.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={el} className={className ?? "h-72 w-full rounded-2xl"} />;
}
