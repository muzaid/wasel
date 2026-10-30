"use client";
import dynamic from "next/dynamic";
export type { MapMarker, MapProps } from "./MapInner";

const Map = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-2xl bg-slate-200" />,
});
export default Map;
