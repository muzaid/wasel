"use client";
import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { uploadFile } from "@/lib/supabase";

/** Shrinks an image in the browser before upload (max side `max` px) so photos load fast on mobile data. */
async function resize(file: File, max = 512): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const keepAlpha = file.type === "image/png" || file.type === "image/webp";
  const type = keepAlpha ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
  return blob ? new File([blob], `photo.${keepAlpha ? "png" : "jpg"}`, { type }) : file;
}

export default function PhotoUpload({
  userId, url, folder, onUploaded, shape = "circle", size = 96, placeholder, label, hint,
}: {
  userId: string; url: string | null | undefined; folder: string; onUploaded: (url: string) => Promise<void> | void;
  shape?: "circle" | "square"; size?: number; placeholder: React.ReactNode; label: string; hint?: string;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const radius = shape === "circle" ? "rounded-full" : "rounded-2xl";

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const small = await resize(file);
      const u = await uploadFile(userId, small, folder);
      await onUploaded(`${u}?v=${Date.now()}`);
    } catch (e) {
      setErr((e as Error).message || t("error"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        className={`group relative shrink-0 overflow-hidden ${radius} border-2 border-white bg-slate-100 shadow ring-1 ring-slate-200`}
        style={{ width: size, height: size }} aria-label={label}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={`h-full w-full ${shape === "square" ? "object-contain bg-white p-1" : "object-cover"}`} />
        ) : (
          <div className="grid h-full w-full place-items-center text-slate-400">{placeholder}</div>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/0 text-white transition group-hover:bg-black/40">
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6 opacity-0 transition group-hover:opacity-100" />}
        </span>
      </button>
      <div className="min-w-0">
        <div className="font-bold">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="mt-2 text-sm font-semibold text-brand-700">
          {busy ? t("loading") : url ? t("change_photo") : t("upload")}
        </button>
        {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
