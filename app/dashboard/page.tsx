"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Profile, UserRole } from "@/lib/types";

type DashboardCard = {
  title: string;
  description: string;
  href?: string;
};

const cardSets: Record<UserRole, DashboardCard[]> = {
  super_admin: [
    { title: "Approvals", description: "Review pending users and assign access.", href: "/admin/approvals" },
    { title: "Schools", description: "Manage school records and affiliation status.", href: "/admin/schools" },
    { title: "Students", description: "Add students, ranks, and membership status.", href: "/students" },
    { title: "Provinces", description: "Maintain the national province structure.", href: "/admin/provinces" },
    { title: "Compliance", description: "Track submissions, expiry dates, and requirements.", href: "/admin/compliance" },
    { title: "Orders", description: "Process school uniform, gear, patch, and belt orders.", href: "/admin/orders" },
    { title: "Portal documents", description: "Upload constitution and shared school resources.", href: "/admin/documents" },
    { title: "Events", description: "Coordinate national and provincial events.", href: "/admin/events" },
    { title: "Tournaments", description: "Manage tournaments and entries.", href: "/admin/tournaments" },
    { title: "Reports", description: "Reporting will be added in the next feature pass." },
  ],
  national_admin: [
    { title: "Approvals", description: "Review pending users and assign access.", href: "/admin/approvals" },
    { title: "Schools", description: "Manage school records and affiliation status.", href: "/admin/schools" },
    { title: "Students", description: "Add students, ranks, and membership status.", href: "/students" },
    { title: "Provinces", description: "Maintain the national province structure.", href: "/admin/provinces" },
    { title: "Compliance", description: "Track submissions, expiry dates, and requirements.", href: "/admin/compliance" },
    { title: "Orders", description: "Process school uniform, gear, patch, and belt orders.", href: "/admin/orders" },
    { title: "Portal documents", description: "Upload constitution and shared school resources.", href: "/admin/documents" },
    { title: "Events", description: "Coordinate national and provincial events.", href: "/admin/events" },
    { title: "Tournaments", description: "Manage tournaments and entries.", href: "/admin/tournaments" },
    { title: "Reports", description: "Reporting will be added in the next feature pass." },
  ],
  provincial_admin: [
    { title: "Province schools", description: "View schools in your province." },
    { title: "Students", description: "Monitor provincial student status.", href: "/students" },
    { title: "Events", description: "Track events in your province." },
    { title: "Compliance", description: "Review provincial compliance status." },
  ],
  school_owner: [
    { title: "My school", description: "Maintain school contact and registration information.", href: "/school/details" },
    { title: "Students", description: "Manage student membership status and ranks.", href: "/students" },
    { title: "Instructors", description: "Track instructors and training status.", href: "/school/instructors" },
    { title: "Compliance", description: "Submit and monitor compliance documents.", href: "/school/compliance" },
    { title: "Events", description: "Add attendees for upcoming NMAA events.", href: "/school/events" },
    { title: "Ordering", description: "Build uniform, sparring gear, patches, and belt orders.", href: "/school/orders" },
    { title: "Resources", description: "View the NMAA South Africa constitution and shared documents.", href: "/resources" },
    { title: "Tournament placements", description: "Add student results for tournaments.", href: "/school/placements" },
  ],
  instructor: [
    { title: "Events", description: "Add attendees for upcoming NMAA events.", href: "/school/events" },
    { title: "Tournament placements", description: "Add student results for tournaments.", href: "/school/placements" },
    { title: "Resources", description: "View the NMAA South Africa constitution and shared documents.", href: "/resources" },
  ],
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        window.location.href = "/login?next=/dashboard";
        return;
      }

      const response = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        window.location.href = "/login?next=/dashboard";
        return;
      }

      const payload = await response.json();

      if (payload.profile.approval_status !== "approved" || !payload.profile.role) {
        window.location.href = "/pending-approval";
        return;
      }

      setProfile(payload.profile);
      setLoading(false);
    }

    loadSession();
  }, []);

  if (loading) {
    return <main className="app-page">Loading dashboard...</main>;
  }

  if (!profile?.role) {
    return null;
  }

  const cards = cardSets[profile.role];

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome, {profile.full_name}</h1>
          <p className="muted">Role: {profile.role.replaceAll("_", " ")}</p>
        </div>
        <div className="row-actions">
          {(profile.role === "super_admin" || profile.role === "national_admin") && (
            <Link className="primary-button compact" href="/admin/approvals">
              Review approvals
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <section className="card-grid">
        {cards.map((card) => (
          <article className="feature-card" key={card.title}>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            {card.href ? (
              <Link className="text-link" href={card.href}>
                Open
              </Link>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
