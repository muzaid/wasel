"use client";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import AppShell from "@/components/AppShell";
import ShipmentRow from "@/components/ShipmentRow";
import { Spinner } from "@/components/ui";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useI18n, TKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import type { Shipment, ShipmentStatus } from "@/lib/types";

export default function History() {
  const ok = useRequireRole("business");
  const { session } = useAuth();
  const { t } = useI18n();
  const [list, setList] = useState<Shipment[] | null>(null);
  const [q, setQ] = useState("");
  const [st, setSt] = useState<ShipmentStatus | "">("");

  useEffect(() => {
    if (!session) return;
    supabase.from("shipments").select("*").eq("business_id", session.user.id).order("created_at", { ascending: false }).limit(1000)
      .then(({ data }) => setList((data as Shipment[]) ?? []));
  }, [session]);

  const filtered = useMemo(() => (list ?? []).filter((s) =>
    (!st || s.status === st) &&
    (!q || [s.code, s.recipient_name, s.recipient_phone, s.dropoff_address].some((x) => x?.toLowerCase().includes(q.toLowerCase())))
  ), [list, q, st]);

  const exportCsv = () => {
    const rows = [["code", "status", "created_at", "pickup", "dropoff", "recipient", "phone", "distance_km", "price", "cod"],
      ...filtered.map((s) => [s.code, s.status, s.created_at, s.pickup_address, s.dropoff_address, s.recipient_name, s.recipient_phone, s.distance_km, s.price, s.cod_amount])];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "wasel-shipments.csv"; a.click();
  };

  if (!ok || !list) return <AppShell><Spinner /></AppShell>;
  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-extrabold">{t("history")}</h1>
        <button onClick={exportCsv} className="btn-ghost"><Download className="h-4 w-4" />CSV</button></div>
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[12rem]" value={st} onChange={(e) => setSt(e.target.value as ShipmentStatus)}>
          <option value="">{t("all")}</option>
          {(["searching", "accepted", "picked_up", "in_transit", "delivered", "cancelled", "expired"] as ShipmentStatus[]).map((s) => <option key={s} value={s}>{t(`st_${s}` as TKey)}</option>)}
        </select>
      </div>
      <div className="space-y-3">{filtered.map((s) => <ShipmentRow key={s.id} s={s} href={`/business/shipments/${s.id}`} />)}</div>
    </AppShell>
  );
}
