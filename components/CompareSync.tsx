"use client";

import { useEffect } from "react";

/** Keeps the comparison tray in step with the trek set shown on /compare. */
export function CompareSync({ slugs }: { slugs: string[] }) {
  const key = slugs.join(",");
  useEffect(() => {
    try {
      localStorage.setItem("pt.compare", JSON.stringify(key ? key.split(",") : []));
      window.dispatchEvent(new StorageEvent("storage", { key: "pt.compare" }));
    } catch {}
  }, [key]);
  return null;
}
