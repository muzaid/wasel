import type { PackageSize, Settings, Vehicle } from "./types";

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Road distance ≈ straight line × 1.3 (same factor as the DB trigger). */
export const roadKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.round(haversineKm(a, b) * 1.3 * 100) / 100;

/** ETA in minutes by vehicle average urban speed. */
export function etaMin(km: number, v: Vehicle = "motorcycle") {
  const speed = { bike: 14, motorcycle: 28, car: 24, van: 20 }[v];
  return Math.max(1, Math.round((km / speed) * 60));
}

/** Mirror of SQL quote_price() for instant preview; the server value is authoritative. */
export function quote(s: Settings, km: number, size: PackageSize, vehicle: Vehicle, fragile: boolean, cod: number) {
  let v = (Number(s.base_fare) + Number(s.per_km) * Math.max(km, 0)) * (s.size_mult?.[size] ?? 1) * (s.vehicle_mult?.[vehicle] ?? 1);
  if (fragile) v += Number(s.fragile_fee);
  if (cod > 0) v += Number(s.cod_fee);
  const price = Math.ceil(Math.max(v, Number(s.min_fare)));
  return { price, fee: Number(s.platform_fee), courier: price - Number(s.platform_fee) };
}

export const money = (n: number | string | null | undefined) => `₪${Number(n ?? 0).toFixed(Number(n) % 1 ? 2 : 0)}`;

export async function searchAddress(q: string, lang: string) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=${lang}&countrycodes=ps,il&q=${encodeURIComponent(q)}`
  );
  if (!r.ok) return [];
  const j = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return j.map((x) => ({ label: x.display_name, lat: +x.lat, lng: +x.lon }));
}

export async function reverseGeocode(lat: number, lng: number, lang: string) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=${lang}&zoom=17`);
    const j = await r.json();
    return (j.display_name as string)?.split(",").slice(0, 3).join(",") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export const navLinks = (lat: number, lng: number) => ({
  google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
});

export const DEFAULT_CENTER = { lat: 31.9038, lng: 35.2034 }; // Ramallah
