import type { Metadata } from "next";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const metadata: Metadata = { title: "Photo credits", robots: { index: false } };

type Credit = { title: string; author: string; license: string; licenseUrl: string; source: string };
async function loadCredits(): Promise<[string, Credit][]> {
  "use cache";
  const raw = await readFile(path.join(process.cwd(), "public/media/photos/credits.json"), "utf8");
  return Object.entries(JSON.parse(raw) as Record<string, Credit>);
}

export default async function Credits() {
  const credits = await loadCredits();
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>Photo credits</li></ol>
        <h1 className="display display--lg">Photo credits</h1>
        <p className="lede">Photographs on this site are used under free licences from Wikimedia Commons. Some are cropped or resized.</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <table className="board">
          <thead><tr><th scope="col">Photo</th><th scope="col">Author</th><th scope="col">Licence</th></tr></thead>
          <tbody>
            {credits.map(([k, c]) => (
              <tr key={k}>
                <td><a href={c.source} rel="noopener">{c.title.replace(/\.(jpe?g|png)$/i, "")}</a></td>
                <td>{c.author}</td>
                <td>{c.licenseUrl ? <a href={c.licenseUrl} rel="noopener license">{c.license}</a> : c.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
