"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { tournamentCategories, tournamentPointsForResult, tournamentResults } from "@/lib/tournamentRules";
import type {
  ComplianceDocument,
  ComplianceRequirement,
  Instructor,
  School,
  Student,
  Tournament,
  TournamentEntry,
} from "@/lib/types";

type BasicInstructor = Pick<Instructor, "id" | "school_id" | "full_name">;
type StudentOption = Pick<Student, "id" | "school_id" | "first_name" | "last_name" | "belt_rank"> & {
  schools?: { name: string } | null;
};

type SchoolSection = "overview" | "details" | "instructors" | "compliance" | "placements";

type SchoolClientProps = {
  section?: SchoolSection;
};

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

const emptySchool = {
  name: "",
  registration_number: "",
  city: "",
  address: "",
  contact_email: "",
  contact_phone: "",
  logo_url: "",
};

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

const emptyDocument = {
  school_id: "",
  instructor_id: "",
  requirement_id: "",
  document_name: "",
  storage_path: "",
  status: "submitted",
  expires_at: "",
};

const emptyPlacement = {
  tournament_id: "",
  student_id: "",
  school_id: "",
  category: "",
  placement: "",
  medal: "participation",
  result_label: "",
  status: "entered",
};

export default function SchoolClient({ section = "overview" }: SchoolClientProps) {
  const [token, setToken] = useState("");
  const [school, setSchool] = useState<School | null>(null);
  const [schoolForm, setSchoolForm] = useState(emptySchool);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorForm, setInstructorForm] = useState(emptyInstructor);
  const [editingInstructorId, setEditingInstructorId] = useState("");
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [documentInstructors, setDocumentInstructors] = useState<BasicInstructor[]>([]);
  const [documentForm, setDocumentForm] = useState(emptyDocument);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState("");
  const [schoolStudents, setSchoolStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [placementForm, setPlacementForm] = useState(emptyPlacement);
  const [editingPlacementId, setEditingPlacementId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  const loadAll = useCallback(async (activeToken: string) => {
    const headers = { Authorization: `Bearer ${activeToken}` };
    const needsInstructors = ["overview", "instructors", "compliance"].includes(section);
    const needsDocuments = ["overview", "compliance"].includes(section);
    const needsPlacements = ["overview", "placements"].includes(section);
    const needsStudents = ["overview", "details"].includes(section);

    const schoolRes = await fetch("/api/school", { headers });
    const schoolPayload = await schoolRes.json();

    if (!schoolRes.ok) {
      setError(schoolPayload.error ?? "Unable to load school.");
      return;
    }

    const [instructorsPayload, documentsPayload, placementsPayload, studentsPayload] = await Promise.all([
      needsInstructors
        ? fetch("/api/instructors", { headers }).then(async (response) => ({
            ok: response.ok,
            payload: await response.json(),
          }))
        : Promise.resolve({ ok: true, payload: { instructors: [] } }),
      needsDocuments
        ? fetch("/api/compliance-documents", { headers }).then(async (response) => ({
            ok: response.ok,
            payload: await response.json(),
          }))
        : Promise.resolve({ ok: true, payload: { documents: [], requirements: [], instructors: [] } }),
      needsPlacements
        ? fetch("/api/tournament-entries", { headers }).then(async (response) => ({
            ok: response.ok,
            payload: await response.json(),
          }))
        : Promise.resolve({ ok: true, payload: { entries: [], tournaments: [], students: [] } }),
      needsStudents
        ? fetch("/api/students", { headers }).then(async (response) => ({
            ok: response.ok,
            payload: await response.json(),
          }))
        : Promise.resolve({ ok: true, payload: { students: [] } }),
    ]);

    if (!instructorsPayload.ok || !documentsPayload.ok || !placementsPayload.ok || !studentsPayload.ok) {
      setError(
        instructorsPayload.payload.error ??
          documentsPayload.payload.error ??
          placementsPayload.payload.error ??
          studentsPayload.payload.error ??
          "Unable to load school workspace.",
      );
      return;
    }

    const activeSchool = schoolPayload.school as School;
    setSchool(activeSchool);
    setSchoolForm({
      name: activeSchool.name,
      registration_number: activeSchool.registration_number ?? "",
      city: activeSchool.city ?? "",
      address: activeSchool.address ?? "",
      contact_email: activeSchool.contact_email ?? "",
      contact_phone: activeSchool.contact_phone ?? "",
      logo_url: activeSchool.logo_url ?? "",
    });
    setInstructors(instructorsPayload.payload.instructors);
    setDocuments(documentsPayload.payload.documents);
    setRequirements(documentsPayload.payload.requirements);
    setDocumentInstructors(documentsPayload.payload.instructors);
    setEntries(placementsPayload.payload.entries);
    setTournaments(placementsPayload.payload.tournaments);
    setStudents(placementsPayload.payload.students);
    setSchoolStudents(studentsPayload.payload.students);
    setInstructorForm((current) => ({ ...current, school_id: activeSchool.id }));
    setDocumentForm((current) => ({
      ...current,
      school_id: activeSchool.id,
      requirement_id: current.requirement_id || documentsPayload.payload.requirements[0]?.id || "",
    }));
    setPlacementForm((current) => ({
      ...current,
      tournament_id: current.tournament_id || placementsPayload.payload.tournaments[0]?.id || "",
      student_id: current.student_id || placementsPayload.payload.students[0]?.id || "",
      school_id: current.school_id || placementsPayload.payload.students[0]?.school_id || activeSchool.id,
    }));
    setError("");
  }, [section]);

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/school";
        return;
      }

      setToken(activeToken);
      await loadAll(activeToken);
    }

    loadSession();
  }, [loadAll]);

  function updateSchoolField(field: keyof typeof emptySchool, value: string) {
    setSchoolForm((current) => ({ ...current, [field]: value }));
  }

  function updateInstructorField(field: keyof typeof emptyInstructor, value: string | boolean) {
    setInstructorForm((current) => ({ ...current, [field]: value }));
  }

  function updateDocumentField(field: keyof typeof emptyDocument, value: string) {
    setDocumentForm((current) => ({ ...current, [field]: value }));
  }

  function updatePlacementField(field: keyof typeof emptyPlacement, value: string) {
    if (field === "student_id") {
      const selectedStudent = students.find((student) => student.id === value);
      setPlacementForm((current) => ({
        ...current,
        student_id: value,
        school_id: selectedStudent?.school_id || school?.id || "",
      }));
      return;
    }

    setPlacementForm((current) => ({ ...current, [field]: value }));
  }

  async function saveSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/school", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(schoolForm),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save school.");
      return;
    }

    await loadAll(token);
  }

  async function uploadSchoolLogo(file: File | null) {
    if (!file) return;

    setLogoBusy(true);
    setError("");

    const formData = new FormData();
    formData.append("logo", file);

    const response = await fetch("/api/school/logo", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = await response.json();
    setLogoBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to upload school logo.");
      return;
    }

    setSchool(payload.school);
    setSchoolForm((current) => ({ ...current, logo_url: payload.logo_url ?? payload.school?.logo_url ?? "" }));
  }

  async function saveInstructor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(editingInstructorId ? `/api/instructors/${editingInstructorId}` : "/api/instructors", {
      method: editingInstructorId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(instructorForm),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save instructor.");
      return;
    }

    setEditingInstructorId("");
    setInstructorForm({ ...emptyInstructor, school_id: school?.id || "" });
    await loadAll(token);
  }

  function editInstructor(instructor: Instructor) {
    setEditingInstructorId(instructor.id);
    setInstructorForm({
      school_id: instructor.school_id,
      full_name: instructor.full_name,
      email: instructor.email ?? "",
      phone: instructor.phone ?? "",
      certification_level: instructor.certification_level ?? "",
      rank: instructor.rank ?? instructor.certification_level ?? "",
      collar_level: instructor.collar_level ?? "",
      certification_date: instructor.certification_date ?? instructor.training_expires_at ?? "",
      training_status: instructor.training_status,
      training_expires_at: instructor.training_expires_at ?? instructor.certification_date ?? "",
      active: instructor.active,
    });
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const formData = new FormData();
    Object.entries(documentForm).forEach(([key, value]) => formData.append(key, value));
    if (documentFile) formData.append("file", documentFile);

    const response = await fetch(
      editingDocumentId ? `/api/compliance-documents/${editingDocumentId}` : "/api/compliance-documents",
      {
        method: editingDocumentId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      },
    );
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save compliance document.");
      return;
    }

    setEditingDocumentId("");
    setDocumentFile(null);
    setDocumentForm({ ...emptyDocument, school_id: school?.id || "", requirement_id: requirements[0]?.id || "" });
    await loadAll(token);
  }

  function editDocument(document: ComplianceDocument) {
    setEditingDocumentId(document.id);
    setDocumentForm({
      school_id: document.school_id ?? school?.id ?? "",
      instructor_id: document.instructor_id ?? "",
      requirement_id: document.requirement_id ?? "",
      document_name: document.document_name,
      storage_path: document.storage_path ?? "",
      status: document.status,
      expires_at: document.expires_at ?? "",
    });
    setDocumentFile(null);
  }

  async function savePlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(
      editingPlacementId ? `/api/tournament-entries/${editingPlacementId}` : "/api/tournament-entries",
      {
        method: editingPlacementId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(placementForm),
      },
    );
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save tournament placement.");
      return;
    }

    setEditingPlacementId("");
    setPlacementForm({
      ...emptyPlacement,
      tournament_id: tournaments[0]?.id || "",
      student_id: students[0]?.id || "",
      school_id: students[0]?.school_id || school?.id || "",
    });
    await loadAll(token);
  }

  function editPlacement(entry: TournamentEntry) {
    setEditingPlacementId(entry.id);
    setPlacementForm({
      tournament_id: entry.tournament_id,
      student_id: entry.student_id,
      school_id: entry.school_id,
      category: entry.category ?? "",
      placement: entry.placement?.toString() ?? "",
      medal: entry.medal ?? "participation",
      result_label: entry.result_label ?? "",
      status: entry.status,
    });
  }

  const sectionTitle = {
    overview: school?.name ?? "My school",
    details: "School information",
    instructors: "Instructors",
    compliance: "Compliance documents",
    placements: "Tournament placements",
  }[section];

  const sectionDescription = {
    overview: "Update school details, instructor training, compliance, and tournament results.",
    details: "Update your school contact and registration information.",
    instructors: "Manage instructor details, certification, and training status.",
    compliance: "Record safeguarding, first aid, NQF, and instructor training documents.",
    placements: "Add entries and results for your school's students.",
  }[section];

  const currentYear = new Date().getFullYear();
  const studentStats = schoolStudents.reduce(
    (stats, student) => {
      stats.total += 1;

      if (student.gender === "male") stats.male += 1;
      if (student.gender === "female") stats.female += 1;

      const race = student.race || "Not recorded";
      stats.race[race] = (stats.race[race] ?? 0) + 1;

      if (student.date_of_birth) {
        const age = currentYear - new Date(student.date_of_birth).getFullYear();
        if (age >= 4 && age <= 6) stats.littleDragons += 1;
        else if (age >= 7 && age <= 12) stats.karateKids += 1;
        else if (age >= 13) stats.teensAdults += 1;
      } else {
        stats.ageNotRecorded += 1;
      }

      return stats;
    },
    {
      total: 0,
      male: 0,
      female: 0,
      littleDragons: 0,
      karateKids: 0,
      teensAdults: 0,
      ageNotRecorded: 0,
      race: {} as Record<string, number>,
    },
  );

  const complianceChecklist = [
    ...requirements
      .filter((requirement) => requirement.applies_to === "school")
      .map((requirement) => {
        const document = documents.find((item) => item.requirement_id === requirement.id && !item.instructor_id);
        return {
          key: `school-${requirement.id}`,
          label: requirement.name,
          owner: school?.name ?? "School",
          document,
        };
      }),
    ...requirements
      .filter((requirement) => requirement.applies_to === "instructor")
      .flatMap((requirement) =>
        instructors.map((instructor) => {
          const document = documents.find((item) => item.requirement_id === requirement.id && item.instructor_id === instructor.id);
          return {
            key: `${instructor.id}-${requirement.id}`,
            label: requirement.name,
            owner: instructor.full_name,
            document,
          };
        }),
      ),
  ];

  function renderHeader() {
    return (
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">School workspace</p>
          <h1>{sectionTitle}</h1>
          <p className="muted">{school?.name ? `${school.name} | ${sectionDescription}` : sectionDescription}</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/school">School sections</Link>
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>
    );
  }

  const errorBlock = error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null;

  if (section === "details") {
    return (
      <main className="app-page">
        {renderHeader()}
        {errorBlock}
        <section className="two-column-workspace">
          <form className="admin-form" onSubmit={saveSchool}>
            <h2>School information</h2>
            <label>School name<input value={schoolForm.name} onChange={(event) => updateSchoolField("name", event.target.value)} required /></label>
            <label>Registration number<input value={schoolForm.registration_number} onChange={(event) => updateSchoolField("registration_number", event.target.value)} /></label>
            <label>City<input value={schoolForm.city} onChange={(event) => updateSchoolField("city", event.target.value)} /></label>
            <label>Address<input value={schoolForm.address} onChange={(event) => updateSchoolField("address", event.target.value)} /></label>
            <label>Contact email<input type="email" value={schoolForm.contact_email} onChange={(event) => updateSchoolField("contact_email", event.target.value)} /></label>
            <label>Contact phone<input value={schoolForm.contact_phone} onChange={(event) => updateSchoolField("contact_phone", event.target.value)} /></label>
            <div className="logo-upload-block">
              <div className="school-logo-preview">
                {schoolForm.logo_url ? (
                  <img src={schoolForm.logo_url} alt={`${schoolForm.name || "School"} logo preview`} />
                ) : (
                  <span>Logo preview</span>
                )}
              </div>
              <label>School logo<input accept="image/png,image/jpeg,image/webp" disabled={!school || logoBusy} type="file" onChange={(event) => uploadSchoolLogo(event.target.files?.[0] ?? null)} /></label>
              <p className="muted">PNG, JPG, or WebP. Maximum 3MB.</p>
            </div>
            <button className="primary-button compact" disabled={busy || !school} type="submit">Save school</button>
          </form>

          <section className="stat-panel">
            <h2>School stats</h2>
            <div className="stat-grid">
              <article><strong>{studentStats.total}</strong><span>Total students</span></article>
              <article><strong>{studentStats.male}</strong><span>Male students</span></article>
              <article><strong>{studentStats.female}</strong><span>Female students</span></article>
              <article><strong>{studentStats.littleDragons}</strong><span>Little Dragons 4-6</span></article>
              <article><strong>{studentStats.karateKids}</strong><span>Karate Kids 7-12</span></article>
              <article><strong>{studentStats.teensAdults}</strong><span>Teens and Adults 13+</span></article>
            </div>
            <h3>Race</h3>
            <p className="muted">
              {Object.entries(studentStats.race).length
                ? Object.entries(studentStats.race).map(([race, count]) => `${race}: ${count}`).join(" | ")
                : "No race data recorded yet."}
            </p>
          </section>

          <section className="stat-panel">
            <h2>Submitted compliance</h2>
            {documents.length === 0 ? (
              <p className="muted">No compliance documents submitted yet.</p>
            ) : (
              documents.map((document) => (
                <article className="mini-row" key={document.id}>
                  <strong>{document.document_name}</strong>
                  <span>{document.compliance_requirements?.name ?? "General"} | {document.status}</span>
                </article>
              ))
            )}
          </section>
        </section>
      </main>
    );
  }

  if (section === "instructors") {
    return (
      <main className="app-page">
        {renderHeader()}
        {errorBlock}
        <section className="two-column-workspace">
          <form className="admin-form" onSubmit={saveInstructor}>
            <h2>{editingInstructorId ? "Edit instructor" : "Add instructor"}</h2>
            <label>Name<input value={instructorForm.full_name} onChange={(event) => updateInstructorField("full_name", event.target.value)} required /></label>
            <label>Email<input type="email" value={instructorForm.email} onChange={(event) => updateInstructorField("email", event.target.value)} /></label>
            <label>Phone<input value={instructorForm.phone} onChange={(event) => updateInstructorField("phone", event.target.value)} /></label>
            <label>Rank<select value={instructorForm.rank} onChange={(event) => updateInstructorField("rank", event.target.value)}><option value="">Select rank</option>{instructorRanks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}</select></label>
            <label>Collar level<select value={instructorForm.collar_level} onChange={(event) => updateInstructorField("collar_level", event.target.value)}><option value="">Select collar</option>{collarLevels.map((collar) => <option key={collar} value={collar}>{collar}</option>)}</select></label>
            <label>Training status<select value={instructorForm.training_status} onChange={(event) => updateInstructorField("training_status", event.target.value)}><option value="pending">pending</option><option value="current">current</option><option value="expired">expired</option><option value="in_training">in training</option></select></label>
            <label>Certification date<input type="date" value={instructorForm.certification_date} onChange={(event) => updateInstructorField("certification_date", event.target.value)} /></label>
            <button className="primary-button compact" disabled={busy || !school} type="submit">{editingInstructorId ? "Save instructor" : "Add instructor"}</button>
          </form>

          <section className="table-list">
            {instructors.map((instructor) => (
              <article className="list-row" key={instructor.id}>
                <div><h2>{instructor.full_name}</h2><p>{instructor.rank ?? instructor.certification_level ?? "No rank"} | Collar {instructor.collar_level ?? "not recorded"} | {instructor.training_status} | Certified {instructor.certification_date ?? instructor.training_expires_at ?? "not recorded"}</p></div>
                <button className="secondary-button compact" onClick={() => editInstructor(instructor)} type="button">Edit</button>
              </article>
            ))}
          </section>
        </section>
      </main>
    );
  }

  if (section === "compliance") {
    return (
      <main className="app-page">
        {renderHeader()}
        {errorBlock}
        <section className="content-shell table-list">
          <h2>Required documents</h2>
          {complianceChecklist.length === 0 ? (
            <article className="empty-state">No active compliance requirements yet.</article>
          ) : (
            complianceChecklist.map((item) => (
              <article className="list-row" key={item.key}>
                <div>
                  <h2>{item.label}</h2>
                  <p>{item.owner} | {item.document?.status ?? "outstanding"} | {item.document?.file_name ?? "no file submitted"}</p>
                </div>
                <span className={`status-pill status-${item.document ? item.document.status : "pending"}`}>
                  {item.document ? "Submitted" : "Needed"}
                </span>
              </article>
            ))
          )}
        </section>
        <section className="two-column-workspace">
          <form className="admin-form" onSubmit={saveDocument}>
            <h2>{editingDocumentId ? "Edit document" : "Add document"}</h2>
            <label>Requirement<select value={documentForm.requirement_id} onChange={(event) => updateDocumentField("requirement_id", event.target.value)}><option value="">None</option>{requirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.name}</option>)}</select></label>
            <label>Instructor<select value={documentForm.instructor_id} onChange={(event) => updateDocumentField("instructor_id", event.target.value)}><option value="">School level</option>{documentInstructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.full_name}</option>)}</select></label>
            <label>Document name<input value={documentForm.document_name} onChange={(event) => updateDocumentField("document_name", event.target.value)} required /></label>
            <label>Document file<input accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp" type="file" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} /></label>
            <label>Status<select value={documentForm.status} onChange={(event) => updateDocumentField("status", event.target.value)}><option value="submitted">submitted</option><option value="pending">pending</option><option value="approved">approved</option><option value="expired">expired</option></select></label>
            <label>Expiry<input type="date" value={documentForm.expires_at} onChange={(event) => updateDocumentField("expires_at", event.target.value)} /></label>
            <button className="primary-button compact" disabled={busy || !school} type="submit">{editingDocumentId ? "Save document" : "Add document"}</button>
          </form>

          <section className="table-list">
            {documents.map((document) => (
              <article className="list-row" key={document.id}>
                <div><h2>{document.document_name}</h2><p>{document.compliance_requirements?.name ?? "General"} | {document.status} | {document.file_name ?? "no file"} | {document.expires_at ?? "no expiry"}</p></div>
                <button className="secondary-button compact" onClick={() => editDocument(document)} type="button">Edit</button>
              </article>
            ))}
          </section>
        </section>
      </main>
    );
  }

  if (section === "placements") {
    return (
      <main className="app-page">
        {renderHeader()}
        {errorBlock}
        <section className="two-column-workspace">
          <form className="admin-form" onSubmit={savePlacement}>
            <h2>{editingPlacementId ? "Edit placement" : "Add placement"}</h2>
            <label>Tournament<select value={placementForm.tournament_id} onChange={(event) => updatePlacementField("tournament_id", event.target.value)} required>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
            <label>Student<select value={placementForm.student_id} onChange={(event) => updatePlacementField("student_id", event.target.value)} required>{students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}</select></label>
            <label>Category<select value={placementForm.category} onChange={(event) => updatePlacementField("category", event.target.value)} required><option value="">Select category</option>{tournamentCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label>Placement<input type="number" min="1" value={placementForm.placement} onChange={(event) => updatePlacementField("placement", event.target.value)} /></label>
            <label>Result<select value={placementForm.medal} onChange={(event) => updatePlacementField("medal", event.target.value)}>{tournamentResults.map((result) => <option key={result} value={result}>{result}</option>)}</select></label>
            <p className="small-note">Points will be calculated automatically: {tournamentPointsForResult(placementForm.medal) ?? 0} points.</p>
            <label>Result note<input value={placementForm.result_label} onChange={(event) => updatePlacementField("result_label", event.target.value)} /></label>
            <button className="primary-button compact" disabled={busy || tournaments.length === 0 || students.length === 0} type="submit">{editingPlacementId ? "Save placement" : "Add placement"}</button>
          </form>

          <section className="table-list">
            {entries.map((entry) => (
              <article className="list-row" key={entry.id}>
                <div><h2>{entry.students?.first_name} {entry.students?.last_name}</h2><p>{entry.tournaments?.name ?? "Tournament"} | {entry.category ?? "No category"} | {entry.medal || entry.placement || entry.result_label || "entered"}</p></div>
                <button className="secondary-button compact" onClick={() => editPlacement(entry)} type="button">Edit</button>
              </article>
            ))}
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-page school-workspace school-focus-${section}`}>
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">School workspace</p>
          <h1>{sectionTitle}</h1>
          <p className="muted">{school?.name && section !== "overview" ? `${school.name} | ${sectionDescription}` : sectionDescription}</p>
        </div>
        <div className="row-actions">
          {section !== "overview" ? <Link className="secondary-button compact" href="/school">All school tools</Link> : null}
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}

      <section className="two-column-workspace school-primary-block">
        <form className="admin-form school-detail-panel" onSubmit={saveSchool}>
          <h2>School information</h2>
          <label>School name<input value={schoolForm.name} onChange={(event) => updateSchoolField("name", event.target.value)} required /></label>
          <label>Registration number<input value={schoolForm.registration_number} onChange={(event) => updateSchoolField("registration_number", event.target.value)} /></label>
          <label>City<input value={schoolForm.city} onChange={(event) => updateSchoolField("city", event.target.value)} /></label>
          <label>Address<input value={schoolForm.address} onChange={(event) => updateSchoolField("address", event.target.value)} /></label>
          <label>Contact email<input type="email" value={schoolForm.contact_email} onChange={(event) => updateSchoolField("contact_email", event.target.value)} /></label>
          <label>Contact phone<input value={schoolForm.contact_phone} onChange={(event) => updateSchoolField("contact_phone", event.target.value)} /></label>
          <div className="logo-upload-block">
            <div className="school-logo-preview">
              {schoolForm.logo_url ? (
                <img src={schoolForm.logo_url} alt={`${schoolForm.name || "School"} logo preview`} />
              ) : (
                <span>Logo preview</span>
              )}
            </div>
            <label>School logo<input accept="image/png,image/jpeg,image/webp" disabled={!school || logoBusy} type="file" onChange={(event) => uploadSchoolLogo(event.target.files?.[0] ?? null)} /></label>
            <p className="muted">PNG, JPG, or WebP. Maximum 3MB.</p>
          </div>
          <button className="primary-button compact" disabled={busy || !school} type="submit">Save school</button>
        </form>

        <section className="stat-panel school-detail-panel">
          <h2>School stats</h2>
          <div className="stat-grid">
            <article><strong>{studentStats.total}</strong><span>Total students</span></article>
            <article><strong>{studentStats.male}</strong><span>Male students</span></article>
            <article><strong>{studentStats.female}</strong><span>Female students</span></article>
            <article><strong>{studentStats.littleDragons}</strong><span>Little Dragons 4-6</span></article>
            <article><strong>{studentStats.karateKids}</strong><span>Karate Kids 7-12</span></article>
            <article><strong>{studentStats.teensAdults}</strong><span>Teens and Adults 13+</span></article>
          </div>
          <h3>Race</h3>
          <p className="muted">
            {Object.entries(studentStats.race).length
              ? Object.entries(studentStats.race).map(([race, count]) => `${race}: ${count}`).join(" | ")
              : "No race data recorded yet."}
          </p>
        </section>

        <section className="stat-panel school-detail-panel">
          <h2>Submitted compliance</h2>
          {documents.length === 0 ? (
            <p className="muted">No compliance documents submitted yet.</p>
          ) : (
            documents.map((document) => (
              <article className="mini-row" key={document.id}>
                <strong>{document.document_name}</strong>
                <span>{document.compliance_requirements?.name ?? "General"} | {document.status}</span>
              </article>
            ))
          )}
        </section>

        <form className="admin-form instructor-form-panel" onSubmit={saveInstructor}>
          <h2>{editingInstructorId ? "Edit instructor" : "Add instructor"}</h2>
          <label>Name<input value={instructorForm.full_name} onChange={(event) => updateInstructorField("full_name", event.target.value)} required /></label>
          <label>Email<input type="email" value={instructorForm.email} onChange={(event) => updateInstructorField("email", event.target.value)} /></label>
          <label>Phone<input value={instructorForm.phone} onChange={(event) => updateInstructorField("phone", event.target.value)} /></label>
          <label>Rank<select value={instructorForm.rank} onChange={(event) => updateInstructorField("rank", event.target.value)}><option value="">Select rank</option>{instructorRanks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}</select></label>
          <label>Collar level<select value={instructorForm.collar_level} onChange={(event) => updateInstructorField("collar_level", event.target.value)}><option value="">Select collar</option>{collarLevels.map((collar) => <option key={collar} value={collar}>{collar}</option>)}</select></label>
          <label>Training status<select value={instructorForm.training_status} onChange={(event) => updateInstructorField("training_status", event.target.value)}><option value="pending">pending</option><option value="current">current</option><option value="expired">expired</option><option value="in_training">in training</option></select></label>
          <label>Certification date<input type="date" value={instructorForm.certification_date} onChange={(event) => updateInstructorField("certification_date", event.target.value)} /></label>
          <button className="primary-button compact" disabled={busy || !school} type="submit">{editingInstructorId ? "Save instructor" : "Add instructor"}</button>
        </form>
      </section>

      <section className="section-title compliance-block"><h2>Compliance Documents</h2><p>Record safeguarding, first aid, NQF, and instructor training documents. File upload storage will attach here later.</p></section>
      <section className="two-column-workspace compliance-block">
        <form className="admin-form" onSubmit={saveDocument}>
          <h2>{editingDocumentId ? "Edit document" : "Add document"}</h2>
          <label>Requirement<select value={documentForm.requirement_id} onChange={(event) => updateDocumentField("requirement_id", event.target.value)}><option value="">None</option>{requirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.name}</option>)}</select></label>
          <label>Instructor<select value={documentForm.instructor_id} onChange={(event) => updateDocumentField("instructor_id", event.target.value)}><option value="">School level</option>{documentInstructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.full_name}</option>)}</select></label>
          <label>Document name<input value={documentForm.document_name} onChange={(event) => updateDocumentField("document_name", event.target.value)} required /></label>
          <label>Document file<input accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp" type="file" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} /></label>
          <label>Status<select value={documentForm.status} onChange={(event) => updateDocumentField("status", event.target.value)}><option value="submitted">submitted</option><option value="pending">pending</option><option value="approved">approved</option><option value="expired">expired</option></select></label>
          <label>Expiry<input type="date" value={documentForm.expires_at} onChange={(event) => updateDocumentField("expires_at", event.target.value)} /></label>
          <button className="primary-button compact" disabled={busy || !school} type="submit">{editingDocumentId ? "Save document" : "Add document"}</button>
        </form>
        <section className="table-list">
          {documents.map((document) => (
            <article className="list-row" key={document.id}>
              <div><h2>{document.document_name}</h2><p>{document.compliance_requirements?.name ?? "General"} | {document.status} | {document.file_name ?? "no file"} | {document.expires_at ?? "no expiry"}</p></div>
              <button className="secondary-button compact" onClick={() => editDocument(document)} type="button">Edit</button>
            </article>
          ))}
        </section>
      </section>

      <section className="section-title placements-block"><h2>Tournament Placements</h2><p>Add entries and results for your school&apos;s students.</p></section>
      <section className="two-column-workspace placements-block">
        <form className="admin-form" onSubmit={savePlacement}>
          <h2>{editingPlacementId ? "Edit placement" : "Add placement"}</h2>
          <label>Tournament<select value={placementForm.tournament_id} onChange={(event) => updatePlacementField("tournament_id", event.target.value)} required>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
          <label>Student<select value={placementForm.student_id} onChange={(event) => updatePlacementField("student_id", event.target.value)} required>{students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}</select></label>
          <label>Category<select value={placementForm.category} onChange={(event) => updatePlacementField("category", event.target.value)} required><option value="">Select category</option>{tournamentCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label>Placement<input type="number" min="1" value={placementForm.placement} onChange={(event) => updatePlacementField("placement", event.target.value)} /></label>
          <label>Result<select value={placementForm.medal} onChange={(event) => updatePlacementField("medal", event.target.value)}>{tournamentResults.map((result) => <option key={result} value={result}>{result}</option>)}</select></label>
          <p className="small-note">Points will be calculated automatically: {tournamentPointsForResult(placementForm.medal) ?? 0} points.</p>
          <label>Result note<input value={placementForm.result_label} onChange={(event) => updatePlacementField("result_label", event.target.value)} /></label>
          <button className="primary-button compact" disabled={busy || tournaments.length === 0 || students.length === 0} type="submit">{editingPlacementId ? "Save placement" : "Add placement"}</button>
        </form>
        <section className="table-list">
          {entries.map((entry) => (
            <article className="list-row" key={entry.id}>
              <div><h2>{entry.students?.first_name} {entry.students?.last_name}</h2><p>{entry.tournaments?.name ?? "Tournament"} | {entry.category ?? "No category"} | {entry.medal || entry.placement || entry.result_label || "entered"}</p></div>
              <button className="secondary-button compact" onClick={() => editPlacement(entry)} type="button">Edit</button>
            </article>
          ))}
        </section>
      </section>

      <section className="section-title instructor-list-block"><h2>Instructors</h2></section>
      <section className="content-shell table-list instructor-list-block">
        {instructors.map((instructor) => (
          <article className="list-row" key={instructor.id}>
            <div><h2>{instructor.full_name}</h2><p>{instructor.rank ?? instructor.certification_level ?? "No rank"} | Collar {instructor.collar_level ?? "not recorded"} | {instructor.training_status} | Certified {instructor.certification_date ?? instructor.training_expires_at ?? "not recorded"}</p></div>
            <button className="secondary-button compact" onClick={() => editInstructor(instructor)} type="button">Edit</button>
          </article>
        ))}
      </section>
    </main>
  );
}
