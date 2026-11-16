import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { createUser, setUserActive } from "@/lib/actions/admin";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { dateTime } from "@/lib/format";
import { Pagination } from "@/components/Pagination";
import { parsePage, slicePage } from "@/lib/pagination";


export default async function Users({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireAdmin(["admin"]);
  const sp = await searchParams;
  const users = await (await db()).collection(C.users).find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: 1 }).toArray();
  return (
    <>
      <header className="a-head"><h1>Users</h1></header>
      <section className="a-card a-scroll">
        <table className="a-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th>Status</th><th><span className="vh">Actions</span></th></tr></thead>
          <tbody>
            {slicePage(users, parsePage(sp.page), 20).items.map((u) => {
              const id = u._id.toHexString();
              return (
                <tr key={id}>
                  <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                  <td>{u.lastLoginAt ? dateTime(u.lastLoginAt.toISOString()) : "Never"}</td>
                  <td>{u.active ? "Active" : "Deactivated"}{u.mustChangePassword ? " · must change password" : ""}</td>
                  <td>{id !== me.id && <form action={setUserActive.bind(null, id, !u.active)}><button className="a-btn a-btn--small">{u.active ? "Deactivate" : "Reactivate"}</button></form>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination p={slicePage(users, parsePage(sp.page), 20).p} path="/admin/users" params={sp} noun="users" variant="admin" />
      </section>
      <section className="a-card">
        <h2>Add a user</h2>
        <SimpleForm action={createUser} submit="Create user" resetOnOk>
          <div className="a-field"><label htmlFor="u-name"><span className="a-label">Name</span></label><input id="u-name" className="a-input" name="name" required /></div>
          <div className="a-field"><label htmlFor="u-email"><span className="a-label">Email</span></label><input id="u-email" className="a-input" type="email" name="email" required /></div>
          <div className="a-field"><label htmlFor="u-role"><span className="a-label">Role</span></label>
            <select id="u-role" className="a-input" name="role" defaultValue="content"><option value="content">Content manager (descriptions, pages, FAQs, media)</option><option value="admin">Administrator (everything)</option></select>
          </div>
          <div className="a-field"><label htmlFor="u-pw"><span className="a-label">Temporary password (12+ characters)</span></label><input id="u-pw" className="a-input" type="password" name="password" autoComplete="new-password" minLength={12} required /></div>
        </SimpleForm>
      </section>
    </>
  );
}
