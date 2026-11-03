"use client";
/** A delivery the visitor filled in before logging in; restored on the "send" page after sign-up. */
const KEY = "wasel_draft";
export function saveDraft(d: unknown) { try { localStorage.setItem(KEY, JSON.stringify({ ...(d as object), savedAt: Date.now() })); } catch { /* private mode */ } }
export function loadDraft<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null;
    const d = JSON.parse(raw); if (Date.now() - (d.savedAt ?? 0) > 24 * 3600 * 1000) { localStorage.removeItem(KEY); return null; }
    return d as T;
  } catch { return null; }
}
export function clearDraft() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

/** Israeli local numbers (05x…) → E.164 (+9725x…), as Supabase phone auth expects. */
export function toE164(phone: string) {
  const d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return "+" + d.slice(1).replace(/\D/g, "");
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.startsWith("0")) return "+972" + d.slice(1);
  if (d.startsWith("972")) return "+" + d;
  return "+" + d;
}
