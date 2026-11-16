"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { CurrencySettings } from "@/lib/types";
import { convert, money } from "@/lib/format";

interface Ctx { settings: CurrencySettings; selected: string; setSelected: (c: string) => void }
const CurrencyCtx = createContext<Ctx | null>(null);
const KEY = "pt.currency";
const listeners = new Set<() => void>();

function read(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function CurrencyProvider({ settings, children }: { settings: CurrencySettings; children: ReactNode }) {
  const stored = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => null,
  );
  const selected = stored && settings.enabled.includes(stored) ? stored : settings.base;
  const setSelected = useCallback((c: string) => {
    try { localStorage.setItem(KEY, c); } catch {}
    listeners.forEach((l) => l());
  }, []);
  return <CurrencyCtx value={{ settings, selected, setSelected }}>{children}</CurrencyCtx>;
}

export function useCurrency() {
  const c = useContext(CurrencyCtx);
  if (!c) throw new Error("useCurrency outside CurrencyProvider");
  return c;
}

/** Shows an amount in the visitor's chosen currency, labelled as an estimate
 *  when it differs from the base (transaction) currency (PRD section 10). */
export function Price({ amount, showBase = false }: { amount: number; showBase?: boolean }) {
  const { settings, selected } = useCurrency();
  const converted = convert(amount, selected, settings.base, settings.rates);
  if (selected === settings.base || converted == null) {
    return <span className="nums">{money(amount, settings.base)}</span>;
  }
  return (
    <span className="nums">
      <span title={`Estimate. You pay in ${settings.base}.`}>{money(converted, selected, { estimate: true })}</span>
      {showBase && <span className="price-base"> ({money(amount, settings.base)})</span>}
    </span>
  );
}

export function CurrencySelect() {
  const { settings, selected, setSelected } = useCurrency();
  if (settings.enabled.length < 2) return null;
  return (
    <label>
      <span className="vh">Display currency</span>
      <select className="currency-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
        {settings.enabled.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  );
}
