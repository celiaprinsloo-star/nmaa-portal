"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { School, Student } from "@/lib/types";

const beltRanks = [
  "White",
  "Yellow",
  "Green",
  "Blue",
  "Red",
  "Black 1st Dan",
  "Black 2nd Dan",
  "Black 3rd Dan",
  "Black 4th Dan",
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadStudents(activeToken: string) {
    const params = new URLSearchParams(window.location.search);
    const requestedSchoolId = params.get("school_id");
    const response = await fetch(requestedSchoolId ? `/api/students?school_id=${encodeURIComponent(requestedSchoolId)}` : "/api/students", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load students.");
      return;
    }

    setStudents(payload.students);
    setSchools(payload.schools);
    setSelectedSchoolName(requestedSchoolId ? payload.schools[0]?.name ?? "" : "");
    setCanManageStudents(Boolean(payload.can_manage_students));
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
  }, []);

  function updateField(field: keyof typeof emptyStudent, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
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
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

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

        <section className="table-list">
          {students.length === 0 ? (
            <article className="empty-state">No students yet.</article>
          ) : (
            students.map((student) => (
              <article className="list-row" key={student.id}>
                <div>
                  <h2>{student.first_name} {student.last_name}</h2>
                  <p>{student.schools?.name ?? "No school"} | {student.belt_rank ?? "No rank"} | {student.gender ?? "gender not recorded"} | {student.race ?? "race not recorded"} | {student.membership_status}</p>
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
      </section>
    </main>
  );
}
