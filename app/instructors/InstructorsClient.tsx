"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Instructor, School } from "@/lib/types";

const instructorRanks = [
  "Green Belt",
  "Purple Belt",
  "Blue Belt",
  "Brown Belt",
  "Red Belt",
  "Rec Black Belt",
  "1st Degree",
  "2nd Degree",
  "3rd Degree",
  "4th Degree",
  "5th Degree",
  "6th Degree",
];

const collarLevels = ["RWR", "BWB", "Red Collar", "Blue Collar", "Black Collar"];

const emptyInstructor = {
  school_id: "",
  full_name: "",
  email: "",
  phone: "",
  certification_level: "",
  rank: "",
  collar_level: "",
  certification_date: "",
  training_status: "pending",
  training_expires_at: "",
  active: true,
};

export default function InstructorsClient() {
  const [token, setToken] = useState("");
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolName, setSelectedSchoolName] = useState("");
  const [canManageInstructors, setCanManageInstructors] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyInstructor);
  const [filters, setFilters] = useState({
    search: "",
    school_id: "",
    status: "",
    rank: "",
    collar: "",
    active: "",
  });
  const [pagination, setPagination] = useState({ page: 1, page_size: 25, total: 0, has_more: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadInstructors(activeToken: string, page = 1, append = false) {
    const params = new URLSearchParams(window.location.search);
    const requestedSchoolId = params.get("school_id");
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("page_size", "25");
    const activeSchoolId = requestedSchoolId || filters.school_id;
    if (activeSchoolId) query.set("school_id", activeSchoolId);
    if (filters.search) query.set("search", filters.search);
    if (filters.status) query.set("status", filters.status);
    if (filters.rank) query.set("rank", filters.rank);
    if (filters.collar) query.set("collar", filters.collar);
    if (filters.active) query.set("active", filters.active);

    const response = await fetch(
      `/api/instructors?${query.toString()}`,
      { headers: { Authorization: `Bearer ${activeToken}` } },
    );
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load instructors.");
      return;
    }

    setInstructors((current) => (append ? [...current, ...payload.instructors] : payload.instructors));
    setSchools(payload.schools);
    setCanManageInstructors(Boolean(payload.can_manage_instructors));
    setPagination(payload.pagination ?? { page, page_size: 25, total: payload.instructors.length, has_more: false });
    setSelectedSchoolName(requestedSchoolId ? payload.schools[0]?.name ?? "" : "");
    setForm((current) => ({ ...current, school_id: current.school_id || payload.schools[0]?.id || "" }));
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

      setToken(activeToken);
      await loadInstructors(activeToken);
    }

    loadSession();
    // The initial session load should run once; filters reload through the page controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field: keyof typeof emptyInstructor, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateFilter(field: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm({ ...emptyInstructor, school_id: schools[0]?.id || "" });
  }

  function editInstructor(instructor: Instructor) {
    setEditingId(instructor.id);
    setForm({
      school_id: instructor.school_id,
      full_name: instructor.full_name,
      email: instructor.email ?? "",
      phone: instructor.phone ?? "",
      certification_level: instructor.certification_level ?? "",
      rank: instructor.rank ?? "",
      collar_level: instructor.collar_level ?? "",
      certification_date: instructor.certification_date ?? "",
      training_status: instructor.training_status,
      training_expires_at: instructor.training_expires_at ?? "",
      active: instructor.active,
    });
  }

  async function saveInstructor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(editingId ? `/api/instructors/${editingId}` : "/api/instructors", {
      method: editingId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save instructor.");
      return;
    }

    resetForm();
    await loadInstructors(token);
  }

  async function deleteInstructor(id: string) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/instructors/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete instructor.");
      return;
    }

    await loadInstructors(token);
  }

  function exportCsv() {
    const header = ["School", "Name", "Email", "Phone", "Rank", "Collar", "Training status", "Certification date", "Active"];
    const lines = instructors.map((instructor) =>
      [
        instructor.schools?.name ?? schools.find((school) => school.id === instructor.school_id)?.name ?? "",
        instructor.full_name,
        instructor.email ?? "",
        instructor.phone ?? "",
        instructor.rank ?? "",
        instructor.collar_level ?? "",
        instructor.training_status,
        instructor.certification_date ?? "",
        instructor.active ? "active" : "inactive",
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    );
    const url = URL.createObjectURL(new Blob([[header.join(","), ...lines].join("\n")].flat(), { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "instructors.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError("");

    const text = await file.text();
    const rows = text.split(/\r?\n/).map((line) => line.split(",").map((value) => value.replace(/^"|"$/g, "").replaceAll('""', '"'))).filter((row) => row.length > 1);
    const [, ...dataRows] = rows;
    const defaultSchoolId = filters.school_id || schools[0]?.id || form.school_id;

    for (const row of dataRows) {
      const [schoolName, fullName, email, phone, rank, collar, trainingStatus, certificationDate, active] = row;
      const matchedSchool = schools.find((school) => school.name.toLowerCase() === String(schoolName ?? "").trim().toLowerCase());
      await fetch("/api/instructors", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: matchedSchool?.id || defaultSchoolId,
          full_name: fullName,
          email,
          phone,
          rank,
          collar_level: collar,
          training_status: trainingStatus || "pending",
          certification_date: certificationDate,
          active: active !== "inactive",
        }),
      });
    }

    setBusy(false);
    await loadInstructors(token);
  }

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

      {canManageInstructors ? (
        <section className="content-shell">
          <form className="admin-form" onSubmit={saveInstructor}>
            <h2>{editingId ? "Edit instructor" : "Add instructor"}</h2>
            <label>School<select value={form.school_id} onChange={(event) => updateField("school_id", event.target.value)} required>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
            <label>Name<input value={form.full_name} onChange={(event) => updateField("full_name", event.target.value)} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} /></label>
            <label>Phone<input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} /></label>
            <label>Rank<select value={form.rank} onChange={(event) => updateField("rank", event.target.value)}><option value="">Select rank</option>{instructorRanks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}</select></label>
            <label>Collar<select value={form.collar_level} onChange={(event) => updateField("collar_level", event.target.value)}><option value="">Select collar</option>{collarLevels.map((collar) => <option key={collar} value={collar}>{collar}</option>)}</select></label>
            <label>Training<select value={form.training_status} onChange={(event) => updateField("training_status", event.target.value)}><option value="pending">pending</option><option value="current">current</option><option value="expired">expired</option><option value="in_training">in training</option></select></label>
            <label>Certification date<input type="date" value={form.certification_date} onChange={(event) => updateField("certification_date", event.target.value)} /></label>
            <label className="checkbox-label"><input checked={form.active} onChange={(event) => updateField("active", event.target.checked)} type="checkbox" /> Active</label>
            <div className="row-actions">
              <button className="primary-button compact" disabled={busy || schools.length === 0} type="submit">{editingId ? "Save instructor" : "Add instructor"}</button>
              {editingId ? <button className="secondary-button compact" onClick={resetForm} type="button">Cancel</button> : null}
            </div>
          </form>
        </section>
      ) : null}

      <section className="content-shell">
        <div className="admin-form">
          <h2>Find instructors</h2>
          <label>Search<input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Name or email" /></label>
          {!selectedSchoolName ? <label>School<select value={filters.school_id} onChange={(event) => updateFilter("school_id", event.target.value)}><option value="">All schools</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label> : null}
          <label>Training<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All training statuses</option><option value="pending">pending</option><option value="current">current</option><option value="expired">expired</option><option value="in_training">in training</option></select></label>
          <label>Rank<select value={filters.rank} onChange={(event) => updateFilter("rank", event.target.value)}><option value="">All ranks</option>{instructorRanks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}</select></label>
          <label>Collar<select value={filters.collar} onChange={(event) => updateFilter("collar", event.target.value)}><option value="">All collars</option>{collarLevels.map((collar) => <option key={collar} value={collar}>{collar}</option>)}</select></label>
          <label>Active<select value={filters.active} onChange={(event) => updateFilter("active", event.target.value)}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <div className="row-actions">
            <button className="primary-button compact" onClick={() => loadInstructors(token)} type="button">Apply filters</button>
            <button className="secondary-button compact" onClick={exportCsv} type="button">Export CSV</button>
            {canManageInstructors ? <label className="secondary-button compact">Import CSV<input accept=".csv" style={{ display: "none" }} type="file" onChange={(event) => importCsv(event.target.files?.[0] ?? null)} /></label> : null}
          </div>
          <p className="small-note">Showing {instructors.length} of {pagination.total} instructors.</p>
        </div>
      </section>

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
              {canManageInstructors ? (
                <div className="row-actions">
                  <button className="secondary-button compact" onClick={() => editInstructor(instructor)} type="button">Edit</button>
                  <button className="danger-button compact" disabled={busy} onClick={() => deleteInstructor(instructor.id)} type="button">Delete</button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
      {pagination.has_more ? (
        <section className="content-shell">
          <button className="secondary-button" disabled={busy} onClick={() => loadInstructors(token, pagination.page + 1, true)} type="button">Load more instructors</button>
        </section>
      ) : null}
    </main>
  );
}
