import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { setInquiryStatus } from "@/lib/actions/admin";
import { dateTime } from "@/lib/format";

export default async function Inquiries() {
  await requireAdmin(["admin"]);
  const rows = await (await db()).collection(C.inquiries).find().sort({ createdAt: -1 }).limit(300).toArray();
  return (
    <>
      <header className="a-head"><h1>Inquiries</h1></header>
      <div className="a-stack">
        {rows.map((r) => {
          const id = r._id.toHexString();
          return (
            <article key={id} className="a-card">
              <div className="a-head" style={{ margin: 0 }}>
                <h2 style={{ margin: 0 }}>{r.name} <span className="a-hint">{r.email}{r.phone ? ` · ${r.phone}` : ""}</span></h2>
                <span className={`a-status a-status--${r.status}`}>{r.status}</span>
              </div>
              <p className="a-hint">{dateTime(r.createdAt?.toISOString?.() ?? r.createdAt)}</p>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.message}</p>
              <div className="a-row-actions">
                <a className="a-btn a-btn--small" href={`mailto:${r.email}?subject=${encodeURIComponent("Your Pala Trekking inquiry")}`}>Reply by email</a>
                {r.status !== "answered" && <form action={setInquiryStatus.bind(null, id, "answered")}><button className="a-btn a-btn--small">Mark answered</button></form>}
                {r.status !== "closed" && <form action={setInquiryStatus.bind(null, id, "closed")}><button className="a-btn a-btn--small">Close</button></form>}
              </div>
            </article>
          );
        })}
        {!rows.length && <p>No inquiries yet.</p>}
      </div>
    </>
  );
}
