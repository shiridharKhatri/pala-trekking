"use client";

import { useEffect, useRef } from "react";

/** Progressive enhancement: submits the surrounding GET form when a control
 *  changes. Without JavaScript the form's own submit button is used. */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const on = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.type === "search" || t.type === "number") return;
      form.requestSubmit();
    };
    form.addEventListener("change", on);
    form.querySelector<HTMLElement>("[data-nojs-submit]")?.setAttribute("hidden", "");
    return () => form.removeEventListener("change", on);
  }, []);
  return <span ref={ref} hidden />;
}
