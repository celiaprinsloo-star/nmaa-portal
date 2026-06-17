import Link from "next/link";
import BrandMark from "../components/BrandMark";

export default function PendingApprovalPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <BrandMark compact />
        <p className="eyebrow">Access pending</p>
        <h1>Your profile is under review</h1>
        <p className="muted">
          A national admin needs to approve your account and assign the right portal access.
        </p>
        <Link className="secondary-button" href="/login">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
