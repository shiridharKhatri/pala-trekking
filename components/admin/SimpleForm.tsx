"use client";

import { useActionState, type ReactNode } from "react";
import type { AdminState } from "@/lib/actions/admin";

/** Wraps a server-rendered field set with action state and messages. */
export function SimpleForm({ action, children, submit, resetOnOk = false }: { action: (s: AdminState, fd: FormData) => Promise<AdminState>; children: ReactNode; submit: string; resetOnOk?: boolean }) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  return (
    <form action={formAction} className="a-form" key={resetOnOk && state.ok ? state.message : undefined}>
      {state.message && <p className={state.ok ? "a-flash a-flash--ok" : "a-flash a-flash--err"} role={state.ok ? "status" : "alert"}>{state.message}</p>}
      {state.errors && Object.keys(state.errors).length > 0 && (
        <ul className="a-flash a-flash--err" role="alert">{Object.entries(state.errors).map(([k, v]) => <li key={k}><strong>{k}</strong>: {v}</li>)}</ul>
      )}
      {children}
      <div className="a-actions"><button className="a-btn a-btn--primary" type="submit" disabled={pending}>{pending ? "Working…" : submit}</button></div>
    </form>
  );
}
