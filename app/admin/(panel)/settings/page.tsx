import { requireAdmin } from "@/lib/auth";
import { ENTITIES, getEntity, loadOptions, toFormValues } from "@/lib/admin/data";
import { saveEntity } from "@/lib/actions/admin";
import { EntityForm } from "@/components/admin/EntityForm";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

export default async function Page() {
  const def = ENTITIES["settings"];
  const user = await requireAdmin(def.roles);
  const stored = (await getEntity(def, "site")) ?? {};
  const doc = { ...DEFAULT_SETTINGS, ...stored, currency: { ...DEFAULT_SETTINGS.currency, ...((stored as { currency?: object }).currency ?? {}) }, home: { ...DEFAULT_SETTINGS.home, ...((stored as { home?: object }).home ?? {}) }, company: { ...DEFAULT_SETTINGS.company, ...((stored as { company?: object }).company ?? {}) } };
  const options = await loadOptions(def.fields);
  return (
    <>
      <header className="a-head"><h1>{def.title}</h1></header>
      <EntityForm fields={def.fields} values={toFormValues(def, doc)} options={options} action={saveEntity.bind(null, "settings", "site")} role={user.role} isNew={false} mediaLibrary={[]} />
    </>
  );
}
