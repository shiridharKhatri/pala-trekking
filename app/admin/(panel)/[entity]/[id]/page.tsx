import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ENTITIES, getEntity, loadOptions, toFormValues } from "@/lib/admin/data";
import { mediaLibrary } from "@/lib/admin/media";
import { deleteEntity, saveEntity } from "@/lib/actions/admin";
import { EntityForm } from "@/components/admin/EntityForm";

export default async function EntityEdit({ params, searchParams }: PageProps<"/admin/[entity]/[id]">) {
  const { entity, id } = await params;
  const sp = await searchParams;
  const def = Object.hasOwn(ENTITIES, entity) ? ENTITIES[entity] : undefined;
  if (!def || def.collection === "settings") notFound();
  const user = await requireAdmin(def.roles);
  const isNew = id === "new";
  if (isNew && !def.canCreate) notFound();
  const doc = isNew ? {} : await getEntity(def, id);
  if (!doc) notFound();
  const defaults: Record<string, unknown> = isNew ? { status: "draft", isPublic: true, weatherEnabled: true, published: true, active: true, minGroup: 2, offlineBooked: 0 } : {};
  const [options, media] = await Promise.all([loadOptions(def.fields), mediaLibrary()]);
  const title = isNew ? `New ${def.singular}` : String(doc[def.titleField] ?? def.singular);
  return (
    <>
      <header className="a-head">
        <div>
          <p className="a-crumb"><Link href={`/admin/${def.key}`}>{def.title}</Link></p>
          <h1>{title}</h1>
        </div>
        <div className="a-head__tools">
          {entity === "treks" && !isNew && doc.status === "published" && <Link className="a-btn" href={`/treks/${doc.slug}`} target="_blank">View on site</Link>}
          {def.canDelete && !isNew && (
            <form action={deleteEntity.bind(null, def.key, id)}><button className="a-btn a-btn--danger" type="submit">Delete</button></form>
          )}
        </div>
      </header>
      {sp.saved && <p className="a-flash a-flash--ok" role="status">Created. You can keep editing.</p>}
      {sp.publishError && <p className="a-flash a-flash--err" role="alert">This trek needs an itinerary, a price and a featured image before it can be published.</p>}
      {sp.deleteBlocked && <p className="a-flash a-flash--err" role="alert">This departure has bookings and cannot be deleted. Close it or hide it from the board instead.</p>}
      {doc.sample === true && <p className="a-flash a-flash--warn">This record contains sample data. Verify every value before launch.</p>}
      <EntityForm
        fields={def.fields}
        values={{ ...defaults, ...toFormValues(def, doc as Record<string, unknown>) , ...(isNew ? defaults : {}) }}
        options={options}
        action={saveEntity.bind(null, def.key, isNew ? null : id)}
        role={user.role}
        isNew={isNew}
        mediaLibrary={media}
        submitLabel={isNew ? `Create ${def.singular}` : "Save changes"}
      />
    </>
  );
}
