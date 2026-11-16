import { Fragment } from "react";

/** Minimal, safe text formatting for admin-edited content: "## " headings,
 *  "- " bullet lists and blank-line paragraphs. No HTML is ever injected. */
export function RichText({ text, className = "prose" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i}>{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{l.trim().slice(2)}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{l}</Fragment>)}</p>;
      })}
    </div>
  );
}
