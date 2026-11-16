import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Pala Trekking admin" }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: LayoutProps<"/admin">) {
  return <div className="admin">{children}</div>;
}
