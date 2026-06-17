import Link from "next/link";
import BrandMark from "../components/BrandMark";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel wide">
        <BrandMark compact />
        <p className="eyebrow">NMAA SA Portal</p>
        <h1>Request access</h1>
        <p className="muted">
          Your profile will be reviewed by the national admin team before access is enabled.
        </p>
        <RegisterForm />
        <p className="small-note">
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
