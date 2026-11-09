/** Public contact details. Set them in Vercel → Environment Variables (the defaults are placeholders). */
export const SUPPORT = {
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "*5544",
  whatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "972525550100",
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@wasel.app",
  address: process.env.NEXT_PUBLIC_SUPPORT_ADDRESS || "Rothschild 22, Tel Aviv",
};
export const TOPICS = ["delivery", "payment", "refund", "coupon", "account", "courier", "payout", "business", "partnership", "press", "complaint", "other"] as const;
export const REFUND_REASONS = ["damaged", "not_picked_up", "charged_twice", "late", "lost", "other"] as const;
export const REFUNDABLE = ["accepted", "arrived_pickup", "picked_up", "in_transit", "delivered", "cancelled", "expired"];
