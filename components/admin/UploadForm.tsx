"use client";

import { useActionState } from "react";
import { uploadMedia, type AdminState } from "@/lib/actions/admin";

export function UploadForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(uploadMedia, { ok: false });
  return (
    <form action={action} className="a-form">
      {state.message && (state.ok
        ? <p className="a-flash a-flash--ok" role="status">Uploaded. Use this path in an image field: <code className="a-mono">{state.message}</code></p>
        : <p className="a-flash a-flash--err" role="alert">{state.message}</p>)}
      <div className="a-field a-field--wide">
        <label htmlFor="file"><span className="a-label">Image (JPEG, PNG or WebP, up to 8 MB)</span></label>
        <input id="file" className="a-input" type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
        <small className="a-hint">Upload the largest clean version you have (at least 2000 px wide for full-width images). The site creates optimized sizes automatically.</small>
      </div>
      <div className="a-actions"><button className="a-btn a-btn--primary" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button></div>
    </form>
  );
}
