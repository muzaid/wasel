export type Role = "customer" | "business" | "courier" | "admin";
export type MemberRole = "owner" | "manager" | "dispatcher";
export type DeliveryType = "b2c" | "c2c" | "b2b";
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
export interface Business {
  id: string; owner_id: string | null; business_name: string; logo_url: string | null; address: string | null; lat: number | null; lng: number | null;
  category: string | null; registration_number: string | null; email: string | null; phone: string | null; verification: "pending" | "approved" | "rejected";
}
export interface Membership { business_id: string; member_role: MemberRole; business: Business }
export interface Settings {
  platform_fee: number; base_fare: number; per_km: number; min_fare: number;
  size_mult: Record<PackageSize, number>; vehicle_mult: Record<Vehicle, number>;
  fragile_fee: number; cod_fee: number; dispatch_count: number; initial_radius_km: number; radius_step_km: number;
  max_radius_km: number; offer_timeout_sec: number; currency: string;
}
export interface Shipment {
  id: string; code: string; business_id: string | null; sender_id: string; recipient_business_id: string | null; delivery_type: DeliveryType;
  dispatch_mode?: "broadcast" | "direct"; requested_courier_id?: string | null; required_vehicle?: Vehicle | null;
  courier_id: string | null; status: ShipmentStatus;
  pickup_address: string; pickup_lat: number; pickup_lng: number; pickup_contact: string | null; pickup_phone: string | null;
  dropoff_address: string; dropoff_lat: number; dropoff_lng: number; recipient_name: string; recipient_phone: string;
  package_size: PackageSize; package_desc: string | null; weight_kg: number | null; vehicle: Vehicle; is_fragile: boolean;
  cod_amount: number; notes: string | null; scheduled_at: string | null; distance_km: number; price: number; platform_fee: number;
  courier_earning: number; tracking_token: string; delivery_otp: string; dispatch_radius_km: number; dispatch_round: number;
  coupon_id?: string | null; discount_amount?: number; credit_used?: number;
  last_dispatch_at: string | null; proof_photo_url: string | null; cancel_reason: string | null; created_at: string;
  accepted_at: string | null; picked_up_at: string | null; delivered_at: string | null; cancelled_at: string | null;
}
export interface Offer { id: number; shipment_id: string; courier_id: string; distance_km: number; status: string; created_at: string }
export interface ShipmentEvent { id: number; shipment_id: string; status: ShipmentStatus; note: string | null; created_at: string }
export interface Notification { id: number; user_id: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }

export const ACTIVE: ShipmentStatus[] = ["accepted", "arrived_pickup", "picked_up", "in_transit"];

/** One row of wasel_nearby_couriers (public card data; location rounded to ~100 m). */
export interface NearbyCourier {
  id: string; full_name: string; avatar_url: string | null; vehicle: Vehicle; vehicle_model: string | null; vehicle_color: string | null;
  rating: number; rating_count: number; deliveries: number; distance_km: number; lat: number; lng: number;
}

// ---------- refunds, credit, coupons, help desk (migration 007) ----------
export type RefundReason = "damaged" | "not_picked_up" | "charged_twice" | "late" | "lost" | "other";
export interface Refund {
  id: number; shipment_id: string; requester_id: string; reason: RefundReason; details: string | null; photo_url: string | null;
  amount: number; method: "card" | "credit"; status: "pending" | "approved" | "rejected"; admin_note: string | null;
  decided_at: string | null; created_at: string;
}
export interface Coupon {
  id: string; code: string; title: string | null; business_id: string | null; kind: "percent" | "fixed"; value: number;
  max_discount: number | null; min_price: number; max_uses: number | null; per_user_limit: number; used_count: number;
  starts_at: string; ends_at: string | null; is_public: boolean; active: boolean; created_at: string;
}
export interface MyCoupon { code: string; title: string | null; kind: "percent" | "fixed"; value: number; min_price: number; ends_at: string | null; business_id: string | null; business_name: string | null; uses_left: number }
export type TicketTopic = "delivery" | "payment" | "refund" | "coupon" | "account" | "courier" | "payout" | "business" | "partnership" | "press" | "complaint" | "other";
export interface Ticket {
  id: number; user_id: string | null; name: string | null; email: string | null; phone: string | null; role: string | null;
  topic: TicketTopic; subject: string; shipment_id: string | null; status: "open" | "answered" | "solved"; created_at: string; updated_at: string;
}
export interface TicketMessage { id: number; ticket_id: number; sender_id: string | null; is_staff: boolean; body: string; created_at: string }
export interface CreditTx { id: number; amount: number; reason: "refund" | "spent" | "returned" | "adjustment"; shipment_id: string | null; note: string | null; created_at: string }
