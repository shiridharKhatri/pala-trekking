import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/lib/actions/admin";
import { AdminNav } from "@/components/admin/AdminNav";

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="a-loading">Loading…</div>}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="a-shell">
      <a href="#a-main" className="a-skip">Skip to content</a>
      <aside className="a-side">
        <Link href="/admin" className="a-brand">Pala Trekking</Link>
        <AdminNav role={user.role} />
        <div className="a-side__foot">
          <Link href="/admin/account">{user.name}</Link>
          <span className="a-tag">{user.role === "admin" ? "Administrator" : "Content manager"}</span>
          <form action={logout}><button className="a-btn a-btn--small" type="submit">Sign out</button></form>
          <Link href="/" target="_blank">View site<span className="vh"> (opens in a new tab)</span></Link>
        </div>
      </aside>
      <main id="a-main" className="a-main">{children}</main>
    </div>
  );
}
