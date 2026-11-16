import Link from "next/link";

// notFound() inside the admin (unknown record type or a deleted record).
export default function AdminNotFound() {
  return (
    <div className="a-404">
      <div className="a-card a-404__card">
        <svg viewBox="0 0 160 48" width="120" aria-hidden="true" focusable="false">
          <path d="M2 44 L22 30 L31 34 L47 16 L56 22 L70 6 L84 24 L94 18 L108 32 L120 26 L134 36 L146 31 L158 44" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <span className="a-404__code">404 · Not found</span>
        <h1>Nothing at this address</h1>
        <p>This record or page doesn&apos;t exist. It may have been deleted, or the link is out of date.</p>
        <div className="a-row-actions" style={{ justifyContent: "center" }}>
          <Link className="a-btn a-btn--primary" href="/admin">Dashboard</Link>
          <Link className="a-btn" href="/admin/bookings">Bookings</Link>
          <Link className="a-btn" href="/admin/treks">Treks</Link>
        </div>
      </div>
    </div>
  );
}
