import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page-head wrap" style={{ minHeight: "70vh" }}>
      <p className="label">Off route</p>
      <h1 className="display display--lg">This trail doesn&apos;t go anywhere</h1>
      <p className="lede">The page may have moved, or the trek is no longer offered.</p>
      <p style={{ marginTop: "2rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link className="btn" href="/treks">Find a trek</Link>
        <Link className="btn btn--ghost" href="/">Home</Link>
      </p>
    </section>
  );
}
