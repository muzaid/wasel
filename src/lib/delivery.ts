import type { DeliveryType, ShipmentStatus } from "./types";

/**
 * Client mirror of the server rule in wasel_shipment_before_insert().
 * Used only for display; the database always decides the stored delivery_type.
 */
export function deliveryType(businessId: string | null | undefined, recipientBusinessId: string | null | undefined): DeliveryType {
  if (!businessId) return "c2c";
  return recipientBusinessId ? "b2b" : "b2c";
}

/** Statuses in which the sender may still cancel (mirrors wasel_cancel_shipment). */
export const CANCELLABLE: ShipmentStatus[] = ["searching", "accepted", "arrived_pickup"];
export const canCancel = (s: ShipmentStatus) => CANCELLABLE.includes(s);

/** Courier step flow (mirrors wasel_advance_shipment). */
export const NEXT_STATUS: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  accepted: "arrived_pickup",
  arrived_pickup: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
};

export const FINISHED: ShipmentStatus[] = ["delivered", "cancelled", "expired"];
export const isFinished = (s: ShipmentStatus) => FINISHED.includes(s);
