import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const isConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});

export async function uploadFile(userId: string, file: File, folder: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl;
}
