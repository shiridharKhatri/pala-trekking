"use client";

import { useActionState } from "react";
import { login, type AdminState } from "@/lib/actions/admin";

export function LoginForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(login, { ok: false });
  return (
    <form action={action} className="a-form" style={{ gap: "1rem" }}>
      {state.message && <p className="a-flash a-flash--err" role="alert">{state.message}</p>}
      <div className="a-field"><label htmlFor="email"><span className="a-label">Email</span></label><input id="email" className="a-input" type="email" name="email" autoComplete="username" required /></div>
      <div className="a-field"><label htmlFor="password"><span className="a-label">Password</span></label><input id="password" className="a-input" type="password" name="password" autoComplete="current-password" required /></div>
      <button className="a-btn a-btn--primary" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
