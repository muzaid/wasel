import { describe, expect, it } from "vitest";
import { canCancel, deliveryType, isFinished, NEXT_STATUS } from "../delivery";
import { etaMin, haversineKm, quote, roadKm } from "../geo";
import type { Settings } from "../types";

const settings: Settings = {
  platform_fee: 1.5, base_fare: 10, per_km: 2.5, min_fare: 15,
  size_mult: { small: 1, medium: 1.2, large: 1.5, xlarge: 2 },
  vehicle_mult: { bike: 0.9, motorcycle: 1, car: 1.3, van: 1.8 },
  fragile_fee: 5, cod_fee: 3, dispatch_count: 5, initial_radius_km: 3, radius_step_km: 3, max_radius_km: 20, offer_timeout_sec: 30, currency: "ILS",
};

describe("delivery relationship (mirrors wasel_shipment_before_insert)", () => {
  it("person → person is C2C", () => expect(deliveryType(null, null)).toBe("c2c"));
  it("business → person is B2C", () => expect(deliveryType("biz-a", null)).toBe("b2c"));
  it("business → business is B2B", () => expect(deliveryType("biz-a", "biz-b")).toBe("b2b"));
  it("a person cannot create B2B", () => expect(deliveryType(null, "biz-b")).toBe("c2c"));
});

describe("pricing preview (mirrors wasel_quote_price)", () => {
  it("applies the minimum fare", () => expect(quote(settings, 0.5, "small", "motorcycle", false, 0).price).toBe(15));
  it("base + per km, rounded up", () => expect(quote(settings, 4, "small", "motorcycle", false, 0).price).toBe(20));
  it("size and vehicle multipliers", () => expect(quote(settings, 4, "large", "car", false, 0).price).toBe(Math.ceil(20 * 1.5 * 1.3)));
  it("fragile and COD fees", () => expect(quote(settings, 4, "small", "motorcycle", true, 100).price).toBe(28));
  it("splits platform fee and courier earning", () => {
    const q = quote(settings, 4, "small", "motorcycle", false, 0);
    expect(q.fee).toBe(1.5);
    expect(q.courier + q.fee).toBe(q.price);
  });
});

describe("distance and ETA", () => {
  const telAviv = { lat: 32.0853, lng: 34.7818 }, ramatGan = { lat: 32.0823, lng: 34.8106 };
  it("haversine is symmetric and plausible", () => {
    expect(haversineKm(telAviv, ramatGan)).toBeCloseTo(haversineKm(ramatGan, telAviv), 10);
    expect(haversineKm(telAviv, ramatGan)).toBeGreaterThan(2.5);
    expect(haversineKm(telAviv, ramatGan)).toBeLessThan(3);
  });
  it("road distance uses the 1.3 factor", () => expect(roadKm(telAviv, ramatGan)).toBeCloseTo(haversineKm(telAviv, ramatGan) * 1.3, 1));
  it("ETA is at least one minute and slower by bike", () => {
    expect(etaMin(0)).toBe(1);
    expect(etaMin(10, "bike")).toBeGreaterThan(etaMin(10, "motorcycle"));
  });
});

describe("delivery state machine (mirrors wasel_advance_shipment / wasel_cancel_shipment)", () => {
  it("courier steps follow a fixed order", () => {
    expect(NEXT_STATUS.accepted).toBe("arrived_pickup");
    expect(NEXT_STATUS.picked_up).toBe("in_transit");
    expect(NEXT_STATUS.in_transit).toBe("delivered");
    expect(NEXT_STATUS.delivered).toBeUndefined();
  });
  it("cancellation only before pickup", () => {
    expect(canCancel("searching")).toBe(true);
    expect(canCancel("arrived_pickup")).toBe(true);
    expect(canCancel("picked_up")).toBe(false);
    expect(canCancel("delivered")).toBe(false);
  });
  it("finished statuses", () => {
    expect(isFinished("delivered")).toBe(true);
    expect(isFinished("in_transit")).toBe(false);
  });
});
