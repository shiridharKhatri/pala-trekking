"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps the compare picker to three treks: once three are ticked, the rest are
 * disabled until one is unticked. The server also compares at most three, so
 * this only stops the visitor from being surprised.
 */
export function CompareLimit({ max = 3 }: { max?: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const boxes = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="treks"]'));
      const n = boxes.filter((b) => b.checked).length;
      boxes.forEach((b) => { b.disabled = !b.checked && n >= max; });
      setFull(n >= max);
    };
    sync();
    form.addEventListener("change", sync);
    return () => form.removeEventListener("change", sync);
  }, [max]);
  return (
    <p ref={ref} className="compare-limit" aria-live="polite" data-full={full || undefined}>
      {full ? `${max} selected. Untick one to choose another.` : `Choose up to ${max}.`}
    </p>
  );
}
