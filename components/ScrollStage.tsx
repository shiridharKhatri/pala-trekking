"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Mounts the vendored Scroll Craft engine on this subtree and tears it down on
 * client navigation. The engine reads data-sc-* attributes from server-rendered
 * markup; it never generates DOM, so all content is in the HTML for SEO and
 * for visitors without JavaScript.
 */
export function ScrollStage({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let inst: ScrollCraftInstance | undefined;
    let cancelled = false;
    (async () => {
      await import("@/vendor/scrollcraft/scrollcraft.js");
      if (cancelled || !ref.current || !window.ScrollCraft) return;
      await document.fonts?.ready;
      if (cancelled || !ref.current) return;
      inst = window.ScrollCraft.mount(ref.current);
    })();
    return () => {
      cancelled = true;
      inst?.destroy();
    };
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
