import { Suspense } from "react";
import BrandMark from "../components/BrandMark";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <BrandMark compact />
        <p className="eyebrow">NMAA SA Portal</p>
        <h1>Reset password</h1>
        <p className="muted">Enter a new password for your portal account.</p>
        <Suspense fallback={<p className="muted">Loading reset form...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
