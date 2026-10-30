import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const isConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Every Wasel table and function in the database is prefixed with `wasel_`, so Wasel can share
 * a Supabase project with other apps without name clashes. The app code uses the short names
 * ("shipments", "accept_offer", ...) and this file adds the prefix in one place.
 */
export const DB_PREFIX = "wasel_";
export const T = (name: string) => DB_PREFIX + name;
export const UPLOADS_BUCKET = "wasel-uploads";

const raw = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});

/* eslint-disable @typescript-eslint/no-explicit-any */
export const supabase = new Proxy(raw, {
  get(target, prop, receiver) {
    if (prop === "from") return (table: string) => target.from(T(table));
    if (prop === "rpc") return (fn: string, args?: any, opts?: any) => target.rpc(T(fn), args, opts);
    if (prop === "channel") {
      return (name: string, opts?: any) => {
        const ch: any = target.channel(name, opts);
        const on = ch.on.bind(ch);
        ch.on = (type: any, filter: any, cb: any) => on(type, filter?.table ? { ...filter, table: T(filter.table) } : filter, cb);
        return ch;
      };
    }
    const v = Reflect.get(target, prop, receiver);
    return typeof v === "function" ? v.bind(target) : v;
  },
}) as SupabaseClient;
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function uploadFile(userId: string, file: File, folder: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${folder}/${Date.now()}.${ext}`;
  const { error } = await raw.storage.from(UPLOADS_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return raw.storage.from(UPLOADS_BUCKET).getPublicUrl(path).data.publicUrl;
}
