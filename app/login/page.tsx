import Link from "next/link";
import { Suspense } from "react";
import BrandMark from "../components/BrandMark";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <BrandMark compact />
        <p className="eyebrow">NMAA SA Portal</p>
        <h1>Sign in</h1>
        <p className="muted">Access your national school-owner portal.</p>
        <Suspense fallback={<p className="muted">Loading sign in...</p>}>
          <LoginForm />
        </Suspense>
        <p className="small-note">
          New to the portal? <Link href="/register">Request access</Link>
        </p>
      </section>
    </main>
  );
}
