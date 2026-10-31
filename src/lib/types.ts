export type Role = "business" | "courier" | "admin";
export type Vehicle = "bike" | "motorcycle" | "car" | "van";
export type PackageSize = "small" | "medium" | "large" | "xlarge";
export type ShipmentStatus =
  | "searching" | "accepted" | "arrived_pickup" | "picked_up" | "in_transit" | "delivered" | "cancelled" | "expired";

export interface Profile { id: string; role: Role; full_name: string; phone: string | null; avatar_url: string | null; is_blocked: boolean; created_at: string }
export interface Courier {
  id: string; vehicle: Vehicle; vehicle_model: string | null; vehicle_color: string | null; plate_number: string | null;
  id_doc_url: string | null; license_doc_url: string | null; verification: "pending" | "approved" | "rejected";
  is_online: boolean; lat: number | null; lng: number | null; heading: number | null; last_seen_at: string | null;
  rating_avg: number; rating_count: number; total_deliveries: number;
}
export interface Business { id: string; business_name: string; logo_url: string | null; address: string | null; lat: number | null; lng: number | null }
export interface Settings {
  platform_fee: number; base_fare: number; per_km: number; min_fare: number;
  size_mult: Record<PackageSize, number>; vehicle_mult: Record<Vehicle, number>;
  fragile_fee: number; cod_fee: number; dispatch_count: number; initial_radius_km: number; radius_step_km: number;
  max_radius_km: number; offer_timeout_sec: number; currency: string;
}
export interface Shipment {
  id: string; code: string; business_id: string; courier_id: string | null; status: ShipmentStatus;
  pickup_address: string; pickup_lat: number; pickup_lng: number; pickup_contact: string | null; pickup_phone: string | null;
  dropoff_address: string; dropoff_lat: number; dropoff_lng: number; recipient_name: string; recipient_phone: string;
  package_size: PackageSize; package_desc: string | null; weight_kg: number | null; vehicle: Vehicle; is_fragile: boolean;
  cod_amount: number; notes: string | null; scheduled_at: string | null; distance_km: number; price: number; platform_fee: number;
  courier_earning: number; tracking_token: string; delivery_otp: string; dispatch_radius_km: number; dispatch_round: number;
  last_dispatch_at: string | null; proof_photo_url: string | null; cancel_reason: string | null; created_at: string;
  accepted_at: string | null; picked_up_at: string | null; delivered_at: string | null; cancelled_at: string | null;
}
export interface Offer { id: number; shipment_id: string; courier_id: string; distance_km: number; status: string; created_at: string }
export interface ShipmentEvent { id: number; shipment_id: string; status: ShipmentStatus; note: string | null; created_at: string }
export interface Notification { id: number; user_id: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }

export const ACTIVE: ShipmentStatus[] = ["accepted", "arrived_pickup", "picked_up", "in_transit"];
