import Link from "next/link";
import BrandMark from "./components/BrandMark";

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <BrandMark />
        <p className="eyebrow">NMAA South Africa</p>
        <h1>National school-owner portal</h1>
        <p className="muted">
          Manage schools, members, events, tournaments, compliance, and instructor status from one place.
        </p>
        <div className="button-row">
          <Link className="primary-button" href="/login">
            Sign in
          </Link>
          <Link className="secondary-button" href="/register">
            Request access
          </Link>
        </div>
      </section>
    </main>
  );
}
