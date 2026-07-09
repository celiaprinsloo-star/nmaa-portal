"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type Stats = {
  school_count: number;
  student_count: number;
  active_students: number;
  inactive_students: number;
  male_students: number;
  female_students: number;
  other_gender_students: number;
  little_dragons: number;
  karate_kids: number;
  teens_adults: number;
  age_not_recorded: number;
  race_counts: Record<string, number>;
};

type ProvinceStats = Stats & {
  id: string;
  name: string;
  code: string;
};

type SchoolStats = Stats & {
  id: string;
  name: string;
  city: string | null;
  province_name: string | null;
  affiliation_status: string;
};

type StatisticsPayload = {
  national: Stats;
  provinces: ProvinceStats[];
  schools: SchoolStats[];
};

function raceSummary(raceCounts: Record<string, number>) {
  const entries = Object.entries(raceCounts);
  if (entries.length === 0) return "No race data";
  return entries.map(([race, count]) => `${race}: ${count}`).join(" | ");
}

function metric(label: string, value: number) {
  return (
    <article className="school-metric" key={label}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

export default function StatisticsClient() {
  const [data, setData] = useState<StatisticsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadStatistics(activeToken: string) {
    const response = await fetch("/api/statistics", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load statistics.");
      setLoading(false);
      return;
    }

    setData(payload);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const activeToken = sessionData.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/statistics";
        return;
      }

      await loadStatistics(activeToken);
    }

    loadSession();
  }, []);

  if (loading) {
    return <main className="app-page">Loading statistics...</main>;
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Statistics</p>
          <h1>National student and school statistics</h1>
          <p className="muted">Totals for NMAA SA, each province, and each school.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}

      {data ? (
        <>
          <section className="section-title">
            <h2>All schools</h2>
            <p>National totals across the whole portal.</p>
          </section>
          <section className="content-shell">
            <div className="school-metric-grid">
              {metric("Schools", data.national.school_count)}
              {metric("Students", data.national.student_count)}
              {metric("Active students", data.national.active_students)}
              {metric("Inactive / cancelled", data.national.inactive_students)}
              {metric("Male", data.national.male_students)}
              {metric("Female", data.national.female_students)}
              {metric("Little Dragons 4-6", data.national.little_dragons)}
              {metric("Karate Kids 7-12", data.national.karate_kids)}
              {metric("Teens and Adults 13+", data.national.teens_adults)}
            </div>
            <p className="school-race-line" style={{ marginTop: 14 }}>{raceSummary(data.national.race_counts)}</p>
          </section>

          <section className="section-title">
            <h2>By province</h2>
            <p>Province totals for schools, students, age brackets, gender, and race.</p>
          </section>
          <section className="tournament-accordion-list">
            {data.provinces.map((province) => (
              <details className="tournament-group" key={province.id}>
                <summary>
                  <span>
                    <strong>{province.name}</strong>
                    <small>{province.school_count} schools | {province.student_count} students</small>
                  </span>
                  <span className="tournament-summary-counts">
                    <b>{province.active_students}</b> active
                    <b>{province.little_dragons + province.karate_kids + province.teens_adults}</b> age grouped
                  </span>
                </summary>
                <dl className="detail-grid" style={{ padding: 18, margin: 0 }}>
                  <div><dt>Schools</dt><dd>{province.school_count}</dd></div>
                  <div><dt>Students</dt><dd>{province.student_count}</dd></div>
                  <div><dt>Male</dt><dd>{province.male_students}</dd></div>
                  <div><dt>Female</dt><dd>{province.female_students}</dd></div>
                  <div><dt>Little Dragons</dt><dd>{province.little_dragons}</dd></div>
                  <div><dt>Karate Kids</dt><dd>{province.karate_kids}</dd></div>
                  <div><dt>Teens and Adults</dt><dd>{province.teens_adults}</dd></div>
                  <div><dt>Race</dt><dd>{raceSummary(province.race_counts)}</dd></div>
                </dl>
              </details>
            ))}
          </section>

          <section className="section-title">
            <h2>By school</h2>
            <p>Each school&apos;s totals at a glance.</p>
          </section>
          <section className="content-shell responsive-table">
            <table>
              <thead>
                <tr>
                  <th>School</th>
                  <th>Province</th>
                  <th>Status</th>
                  <th>Students</th>
                  <th>Male</th>
                  <th>Female</th>
                  <th>4-6</th>
                  <th>7-12</th>
                  <th>13+</th>
                  <th>Race</th>
                </tr>
              </thead>
              <tbody>
                {data.schools.map((school) => (
                  <tr key={school.id}>
                    <td>{school.name}{school.city ? `, ${school.city}` : ""}</td>
                    <td>{school.province_name ?? "No province"}</td>
                    <td>{school.affiliation_status}</td>
                    <td>{school.student_count}</td>
                    <td>{school.male_students}</td>
                    <td>{school.female_students}</td>
                    <td>{school.little_dragons}</td>
                    <td>{school.karate_kids}</td>
                    <td>{school.teens_adults}</td>
                    <td>{raceSummary(school.race_counts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}
