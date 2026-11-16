import { requireAdmin } from "@/lib/auth";
import { changePassword } from "@/lib/actions/admin";
import { SimpleForm } from "@/components/admin/SimpleForm";

export default async function Account({ searchParams }: PageProps<"/admin/account">) {
  const me = await requireAdmin(undefined, { allowPendingPassword: true });
  const sp = await searchParams;
  return (
    <>
      <header className="a-head"><h1>Your account</h1></header>
      {sp.first && <p className="a-flash a-flash--warn">Please replace your temporary password before continuing.</p>}
      <section className="a-card">
        <p>{me.name} · {me.email} · {me.role}</p>
        <SimpleForm action={changePassword} submit="Change password">
          <div className="a-field"><label htmlFor="current"><span className="a-label">Current password</span></label><input id="current" className="a-input" type="password" name="current" autoComplete="current-password" required /></div>
          <div className="a-field"><label htmlFor="next"><span className="a-label">New password (12+ characters)</span></label><input id="next" className="a-input" type="password" name="next" autoComplete="new-password" minLength={12} required /></div>
          <div className="a-field"><label htmlFor="confirm"><span className="a-label">Confirm new password</span></label><input id="confirm" className="a-input" type="password" name="confirm" autoComplete="new-password" minLength={12} required /></div>
        </SimpleForm>
      </section>
    </>
  );
}
