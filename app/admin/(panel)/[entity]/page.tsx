import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ENTITIES, countEntity, listEntity, loadOptions } from "@/lib/admin/data";
import { Pagination } from "@/components/Pagination";
import { paginate, parsePage } from "@/lib/pagination";

const PAGE_SIZE = 25;
import { setStatus } from "@/lib/actions/admin";
import { money } from "@/lib/format";

export default async function EntityList({ params, searchParams }: PageProps<"/admin/[entity]">) {
  const { entity } = await params;
  const sp = await searchParams;
  const def = Object.hasOwn(ENTITIES, entity) ? ENTITIES[entity] : undefined;
  if (!def || def.collection === "settings") notFound();
  const user = await requireAdmin(def.roles);
  const pg = paginate(await countEntity(def), parsePage(sp.page), PAGE_SIZE);
  const [rows, opts] = await Promise.all([listEntity(def, pg.skip, PAGE_SIZE), loadOptions([{ name: "x", label: "", type: "select", optionSource: "treks" }])]);
  const trekName = (id: unknown) => opts.treks?.find((t) => t.value === id)?.label ?? String(id ?? "");
  const show = (k: string, v: unknown) => {
    if (k === "trekId") return trekName(v);
    if (k === "basePrice" || k === "price") return typeof v === "number" ? money(v, "USD") : "";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (k === "status") return <span className={`a-status a-status--${v}`}>{String(v)}</span>;
    return v == null || v === "" ? "–" : String(v);
  };
  return (
    <>
      <header className="a-head">
        <h1>{def.title}</h1>
        {def.canCreate && <Link className="a-btn a-btn--primary" href={`/admin/${def.key}/new`}>New {def.singular}</Link>}
      </header>
      {sp.deleted && <p className="a-flash a-flash--ok" role="status">Deleted.</p>}
      <div className="a-card a-scroll">
        <table className="a-table">
          <thead><tr>{def.listColumns.map((c) => <th key={c.name} scope="col">{c.label}</th>)}<th scope="col"><span className="vh">Actions</span></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                {def.listColumns.map((c, i) => (
                  <td key={c.name}>{i === 0 ? <Link href={`/admin/${def.key}/${r.id}`}>{show(c.name, r[c.name])}</Link> : show(c.name, r[c.name])}</td>
                ))}
                <td className="a-row-actions">
                  {r.sample === true && <span className="a-tag a-tag--warn">sample</span>}
                  {def.hasStatus && user.role === "admin" && (
                    <>
                      {r.status !== "published" && <form action={setStatus.bind(null, def.key, String(r.id), "published")}><button className="a-btn a-btn--small">Publish</button></form>}
                      {r.status === "published" && <form action={setStatus.bind(null, def.key, String(r.id), "draft")}><button className="a-btn a-btn--small">Unpublish</button></form>}
                      {r.status !== "archived" && <form action={setStatus.bind(null, def.key, String(r.id), "archived")}><button className="a-btn a-btn--small">Archive</button></form>}
                    </>
                  )}
                  {entity === "treks" && r.status === "published" && <Link className="a-btn a-btn--small" href={`/treks/${r.slug}`} target="_blank">View</Link>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={def.listColumns.length + 1}>Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} path={`/admin/${def.key}`} params={sp} noun={def.title.toLowerCase()} variant="admin" />
    </>
  );
}
