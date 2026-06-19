"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { School, Student } from "@/lib/types";

const beltRanks = [
  "White",
  "White/Orange",
  "Orange",
  "Orange/Yellow",
  "Yellow",
  "Yellow/Camo",
  "Camo",
  "Green",
  "Purple",
  "Blue",
  "Brown",
  "Red",
  "Rec Black",
  "Black 1st Deg",
  "Black 2nd Deg",
  "Black 3rd Deg",
  "Black 4th Deg",
];

const emptyStudent = {
  school_id: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  race: "",
  belt_rank: "White",
  membership_status: "active",
};

export default function StudentsClient() {
  const [token, setToken] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyStudent);
  const [selectedSchoolName, setSelectedSchoolName] = useState("");
  const [canManageStudents, setCanManageStudents] = useState(false);
  const [profileRole, setProfileRole] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    school_id: "",
    status: "",
    gender: "",
    race: "",
    rank: "",
  });
  const [pagination, setPagination] = useState({ page: 1, page_size: 25, total: 0, has_more: false });
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadStudents(activeToken: string, page = 1, append = false) {
    const params = new URLSearchParams(window.location.search);
    const requestedSchoolId = params.get("school_id");
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("page_size", "25");
    const activeSchoolId = requestedSchoolId || filters.school_id;
    if (activeSchoolId) query.set("school_id", activeSchoolId);
    if (filters.search) query.set("search", filters.search);
    if (filters.status) query.set("status", filters.status);
    if (filters.gender) query.set("gender", filters.gender);
    if (filters.race) query.set("race", filters.race);
    if (filters.rank) query.set("rank", filters.rank);

    const response = await fetch(`/api/students?${query.toString()}`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load students.");
      return;
    }

    setStudents((current) => (append ? [...current, ...payload.students] : payload.students));
    setSchools(payload.schools);
    setSelectedSchoolName(requestedSchoolId ? payload.schools[0]?.name ?? "" : "");
    setCanManageStudents(Boolean(payload.can_manage_students));
    setProfileRole(payload.profile_role ?? "");
    setPagination(payload.pagination ?? { page, page_size: 25, total: payload.students.length, has_more: false });
    setForm((current) => ({
      ...current,
      school_id: current.school_id || payload.schools[0]?.id || "",
    }));
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/students";
        return;
      }

      setToken(activeToken);
      await loadStudents(activeToken);
    }

    loadSession();
    // The initial session load should run once; filters reload through the page controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field: keyof typeof emptyStudent, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateFilter(field: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm({
      ...emptyStudent,
      school_id: schools[0]?.id || "",
    });
  }

  function editStudent(student: Student) {
    setEditingId(student.id);
    setForm({
      school_id: student.school_id,
      first_name: student.first_name,
      last_name: student.last_name,
      date_of_birth: student.date_of_birth ?? "",
      gender: student.gender ?? "",
      race: student.race ?? "",
      belt_rank: student.belt_rank ?? "White",
      membership_status: student.membership_status,
    });
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(editingId ? `/api/students/${editingId}` : "/api/students", {
      method: editingId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save student.");
      return;
    }

    resetForm();
    await loadStudents(token);
  }

  async function deleteStudent(studentId: string) {
    setBusy(true);
    setError("");

    const response = await fetch(`/api/students/${studentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete student.");
      return;
    }

    await loadStudents(token);
  }

  function exportCsv() {
    const header = ["School", "First name", "Last name", "Date of birth", "Gender", "Race", "Rank", "Status"];
    const lines = students.map((student) =>
      [
        student.schools?.name ?? "",
        student.first_name,
        student.last_name,
        student.date_of_birth ?? "",
        student.gender ?? "",
        student.race ?? "",
        student.belt_rank ?? "",
        student.membership_status,
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "students.csv";
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
      const [schoolName, firstName, lastName, dateOfBirth, gender, race, rank, status] = row;
      const matchedSchool = schools.find((school) => school.name.toLowerCase() === String(schoolName ?? "").trim().toLowerCase());
      await fetch("/api/students", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: matchedSchool?.id || defaultSchoolId,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dateOfBirth,
          gender,
          race,
          belt_rank: rank || "White",
          membership_status: status || "active",
        }),
      });
    }

    setBusy(false);
    await loadStudents(token);
  }

  async function importLegacyMembers() {
    setBusy(true);
    setError("");
    setSyncMessage("");

    const response = await fetch("/api/admin/legacy-portal-sync/members", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      const details = Array.isArray(payload.result?.errors)
        ? ` ${payload.result.errors.join(" ")}`
        : "";
      setError(`${payload.error ?? "Unable to import Legacy members."}${details}`);
      return;
    }

    const imported = payload.result?.imported;
    const skipped = payload.result?.skipped;
    const reasons = Array.isArray(payload.result?.errors)
      ? ` ${payload.result.errors.join(" ")}`
      : "";
    setSyncMessage(
      `Legacy members imported: ${imported?.students ?? 0} students and ${
        imported?.instructors ?? 0
      } instructors. Skipped ${skipped?.students ?? 0} students and ${
        skipped?.instructors ?? 0
      } instructors.${reasons}`
    );
    await loadStudents(token);
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Students</p>
          <h1>{selectedSchoolName ? `${selectedSchoolName} students` : "Student records and ranks"}</h1>
          <p className="muted">{canManageStudents ? "Add students, keep ranks current, and maintain membership status." : "View student details from the schools you oversee."}</p>
        </div>
        <div className="row-actions">
          {["super_admin", "national_admin"].includes(profileRole) ? (
            <button className="secondary-button compact" disabled={busy || !token} onClick={importLegacyMembers} type="button">
              Import Legacy Members
            </button>
          ) : null}
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>
      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}
      {syncMessage ? <section className="content-shell"><p className="form-success">{syncMessage}</p></section> : null}

      <section className={canManageStudents ? "admin-workspace" : "content-shell"}>
        {canManageStudents ? (
        <form className="admin-form" onSubmit={saveStudent}>
          <h2>{editingId ? "Edit student" : "Add student"}</h2>
          <label>
            School
            <select value={form.school_id} onChange={(event) => updateField("school_id", event.target.value)} required>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </label>
          <label>
            First name
            <input value={form.first_name} onChange={(event) => updateField("first_name", event.target.value)} required />
          </label>
          <label>
            Last name
            <input value={form.last_name} onChange={(event) => updateField("last_name", event.target.value)} required />
          </label>
          <label>
            Date of birth
            <input type="date" value={form.date_of_birth} onChange={(event) => updateField("date_of_birth", event.target.value)} />
          </label>
          <label>
            Gender
            <select value={form.gender} onChange={(event) => updateField("gender", event.target.value)} required>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Race
            <select value={form.race} onChange={(event) => updateField("race", event.target.value)}>
              <option value="">Select race</option>
              <option value="White">White</option>
              <option value="Black">Black</option>
              <option value="Coloured">Coloured</option>
              <option value="Indian">Indian</option>
              <option value="Asian">Asian</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            Rank
            <select value={form.belt_rank} onChange={(event) => updateField("belt_rank", event.target.value)}>
              {beltRanks.map((rank) => (
                <option key={rank} value={rank}>{rank}</option>
              ))}
            </select>
          </label>
          <label>
            Membership status
            <select value={form.membership_status} onChange={(event) => updateField("membership_status", event.target.value)}>
              <option value="active">active</option>
              <option value="pending">pending</option>
              <option value="inactive">inactive</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="row-actions">
            <button className="primary-button compact" disabled={busy || schools.length === 0} type="submit">
              {editingId ? "Save changes" : "Add student"}
            </button>
            {editingId ? (
              <button className="secondary-button compact" onClick={resetForm} type="button">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        ) : null}

        <section className="admin-form">
          <h2>Find students</h2>
          <label>Search<input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Name" /></label>
          {!selectedSchoolName ? (
            <label>School<select value={filters.school_id} onChange={(event) => updateFilter("school_id", event.target.value)}><option value="">All schools</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
          ) : null}
          <label>Status<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option><option value="active">active</option><option value="pending">pending</option><option value="inactive">inactive</option><option value="cancelled">cancelled</option></select></label>
          <label>Gender<select value={filters.gender} onChange={(event) => updateFilter("gender", event.target.value)}><option value="">All genders</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
          <label>Race<select value={filters.race} onChange={(event) => updateFilter("race", event.target.value)}><option value="">All race groups</option><option value="White">White</option><option value="Black">Black</option><option value="Coloured">Coloured</option><option value="Indian">Indian</option><option value="Asian">Asian</option><option value="Other">Other</option></select></label>
          <label>Rank<select value={filters.rank} onChange={(event) => updateFilter("rank", event.target.value)}><option value="">All ranks</option>{beltRanks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}</select></label>
          <div className="row-actions">
            <button className="primary-button compact" onClick={() => loadStudents(token)} type="button">Apply filters</button>
            <button className="secondary-button compact" onClick={() => { setFilters({ search: "", school_id: "", status: "", gender: "", race: "", rank: "" }); window.setTimeout(() => loadStudents(token), 0); }} type="button">Clear</button>
            <button className="secondary-button compact" onClick={exportCsv} type="button">Export CSV</button>
            {canManageStudents ? <a className="secondary-button compact" download href="/sample-students-import.csv">Download sample CSV</a> : null}
            {canManageStudents ? <label className="secondary-button compact">Import CSV<input accept=".csv" style={{ display: "none" }} type="file" onChange={(event) => importCsv(event.target.files?.[0] ?? null)} /></label> : null}
          </div>
          {canManageStudents ? (
            <p className="small-note">
              Import columns must stay in this order: School, First name, Last name, Date of birth, Gender, Race, Rank, Status.
            </p>
          ) : null}
          <p className="small-note">Showing {students.length} of {pagination.total} students.</p>
        </section>

        <section className="table-list">
          {students.length === 0 ? (
            <article className="empty-state">No students yet.</article>
          ) : (
            students.map((student) => (
              <article className="list-row" key={student.id}>
                <div>
                  <h2>{student.first_name} {student.last_name}</h2>
                  <dl className="detail-grid">
                    <div><dt>School</dt><dd>{student.schools?.name ?? "No school"}</dd></div>
                    <div><dt>Rank</dt><dd>{student.belt_rank ?? "No rank"}</dd></div>
                    <div><dt>Gender</dt><dd>{student.gender ?? "Not recorded"}</dd></div>
                    <div><dt>Race</dt><dd>{student.race ?? "Not recorded"}</dd></div>
                    <div><dt>Status</dt><dd>{student.membership_status}</dd></div>
                  </dl>
                </div>
                {canManageStudents ? (
                <div className="row-actions">
                  <button className="secondary-button compact" onClick={() => editStudent(student)} type="button">
                    Edit
                  </button>
                  <button className="danger-button compact" disabled={busy} onClick={() => deleteStudent(student.id)} type="button">
                    Delete
                  </button>
                </div>
                ) : null}
              </article>
            ))
          )}
        </section>
        {pagination.has_more ? (
          <section className="content-shell">
            <button className="secondary-button" disabled={busy} onClick={() => loadStudents(token, pagination.page + 1, true)} type="button">Load more students</button>
          </section>
        ) : null}
      </section>
    </main>
  );
}
