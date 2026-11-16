import { requireAdmin } from "@/lib/auth";
import { mediaLibrary } from "@/lib/admin/media";
import { UploadForm } from "@/components/admin/UploadForm";

export default async function MediaPage() {
  await requireAdmin(["admin", "content"]);
  const items = await mediaLibrary();
  return (
    <>
      <header className="a-head"><h1>Media</h1></header>
      <section className="a-card"><h2>Upload</h2><UploadForm /></section>
      <section className="a-card">
        <h2>Library</h2>
        <p className="a-hint">Copy a path into any image field. Always add alternative text describing the image, and a credit when the photographer requires one.</p>
        <ul className="a-media-grid">
          {items.map((src) => (
            <li key={src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" />
              <code className="a-mono">{src}</code>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
