"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Instructor, School } from "@/lib/types";

export default function InstructorsClient() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolName, setSelectedSchoolName] = useState("");
  const [error, setError] = useState("");

  async function loadInstructors(activeToken: string) {
    const params = new URLSearchParams(window.location.search);
    const requestedSchoolId = params.get("school_id");
    const response = await fetch(
      requestedSchoolId ? `/api/instructors?school_id=${encodeURIComponent(requestedSchoolId)}` : "/api/instructors",
      { headers: { Authorization: `Bearer ${activeToken}` } },
    );
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load instructors.");
      return;
    }

    setInstructors(payload.instructors);
    setSchools(payload.schools);
    setSelectedSchoolName(requestedSchoolId ? payload.schools[0]?.name ?? "" : "");
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/instructors";
        return;
      }

      await loadInstructors(activeToken);
    }

    loadSession();
  }, []);

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Instructors</p>
          <h1>{selectedSchoolName ? `${selectedSchoolName} instructors` : "Instructor information"}</h1>
          <p className="muted">Review rank, collar level, training status, and certification dates.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/admin/schools">Schools</Link>
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}

      <section className="content-shell table-list">
        {instructors.length === 0 ? (
          <article className="empty-state">No instructors recorded yet.</article>
        ) : (
          instructors.map((instructor) => (
            <article className="list-row" key={instructor.id}>
              <div>
                <h2>{instructor.full_name}</h2>
                <dl className="detail-grid">
                  <div><dt>School</dt><dd>{instructor.schools?.name ?? schools.find((school) => school.id === instructor.school_id)?.name ?? "No school"}</dd></div>
                  <div><dt>Rank</dt><dd>{instructor.rank ?? instructor.certification_level ?? "No rank"}</dd></div>
                  <div><dt>Collar</dt><dd>{instructor.collar_level ?? "Not recorded"}</dd></div>
                  <div><dt>Training</dt><dd>{instructor.training_status}</dd></div>
                  <div><dt>Certified</dt><dd>{instructor.certification_date ?? instructor.training_expires_at ?? "Not recorded"}</dd></div>
                </dl>
              </div>
              <span className={`status-pill status-${instructor.active ? "active" : "suspended"}`}>
                {instructor.active ? "active" : "inactive"}
              </span>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
