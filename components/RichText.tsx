import { Fragment, type ReactNode } from "react";

/** Minimal, safe text formatting for admin-edited content: "## " headings,
 *  "- " bullet lists and blank-line paragraphs. No HTML is ever injected.
 *  A heading may sit directly above its text or list (no blank line needed),
 *  and a paragraph may run straight into a list. */
export function RichText({ text, className = "prose" }: { text: string; className?: string }) {
  const out: ReactNode[] = [];
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  blocks.forEach((b, i) => {
    // Group consecutive lines into heading / list / paragraph runs.
    let para: string[] = [], list: string[] = [];
    const flush = (k: string) => {
      if (para.length) out.push(<p key={`${k}p`}>{para.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{l}</Fragment>)}</p>);
      if (list.length) out.push(<ul key={`${k}u`}>{list.map((l, j) => <li key={j}>{l}</li>)}</ul>);
      para = []; list = [];
    };
    b.split("\n").forEach((raw, j) => {
      const l = raw.trim();
      if (l.startsWith("## ")) { flush(`${i}-${j}`); out.push(<h2 key={`${i}-${j}h`}>{l.slice(3)}</h2>); }
      else if (l.startsWith("- ")) { if (para.length) flush(`${i}-${j}`); list.push(l.slice(2)); }
      else { if (list.length) flush(`${i}-${j}`); para.push(l); }
    });
    flush(`${i}-end`);
  });
  return <div className={className}>{out}</div>;
}
