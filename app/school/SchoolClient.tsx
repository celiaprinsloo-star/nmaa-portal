"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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

type SchoolSection = "overview" | "details" | "instructors" | "compliance" | "results" | "tournaments";

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

const emptyResult = {
  tournament_id: "",
  student_id: "",
  school_id: "",
  category: "",
  medal: "participation",
  result_label: "",
  status: "entered",
};

const emptyRegistration = {
  tournament_id: "",
  student_id: "",
  school_id: "",
  category: "",
  medal: "",
  result_label: "",
  status: "registered",
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
  const [resultForm, setResultForm] = useState(emptyResult);
  const [editingResultId, setEditingResultId] = useState("");
  const [registrationForm, setRegistrationForm] = useState(emptyRegistration);
  const [registrationCategories, setRegistrationCategories] = useState<string[]>([]);
  const [editingRegistrationId, setEditingRegistrationId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [todayTimestamp] = useState(() => Date.now());
  const registrationFormRef = useRef<HTMLFormElement | null>(null);

  const loadAll = useCallback(async (activeToken: string) => {
    const headers = { Authorization: `Bearer ${activeToken}` };
    const needsInstructors = ["overview", "instructors", "compliance"].includes(section);
    const needsDocuments = ["overview", "compliance"].includes(section);
    const needsResults = ["overview", "results", "tournaments"].includes(section);
    const needsStudents = ["overview", "details"].includes(section);

    const schoolRes = await fetch("/api/school", { headers });
    const schoolPayload = await schoolRes.json();

    if (!schoolRes.ok) {
      setError(schoolPayload.error ?? "Unable to load school.");
      return;
    }

    const [instructorsPayload, documentsPayload, resultsPayload, studentsPayload] = await Promise.all([
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
      needsResults
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

    if (!instructorsPayload.ok || !documentsPayload.ok || !resultsPayload.ok || !studentsPayload.ok) {
      setError(
        instructorsPayload.payload.error ??
          documentsPayload.payload.error ??
          resultsPayload.payload.error ??
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
    setEntries(resultsPayload.payload.entries);
    setTournaments(resultsPayload.payload.tournaments);
    setStudents(resultsPayload.payload.students);
    setSchoolStudents(studentsPayload.payload.students);
    setInstructorForm((current) => ({ ...current, school_id: activeSchool.id }));
    setDocumentForm((current) => ({
      ...current,
      school_id: activeSchool.id,
      requirement_id: current.requirement_id || documentsPayload.payload.requirements[0]?.id || "",
    }));
    setResultForm((current) => ({
      ...current,
      tournament_id: current.tournament_id || resultsPayload.payload.tournaments[0]?.id || "",
      student_id: current.student_id || resultsPayload.payload.students[0]?.id || "",
      school_id: current.school_id || resultsPayload.payload.students[0]?.school_id || activeSchool.id,
    }));
    setRegistrationForm((current) => ({
      ...current,
      tournament_id: current.tournament_id || resultsPayload.payload.tournaments[0]?.id || "",
      student_id: current.student_id || resultsPayload.payload.students[0]?.id || "",
      school_id: current.school_id || resultsPayload.payload.students[0]?.school_id || activeSchool.id,
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

  function updateResultField(field: keyof typeof emptyResult, value: string) {
    if (field === "student_id") {
      const selectedStudent = students.find((student) => student.id === value);
      setResultForm((current) => ({
        ...current,
        student_id: value,
        school_id: selectedStudent?.school_id || school?.id || "",
      }));
      return;
    }

    setResultForm((current) => ({ ...current, [field]: value }));
  }

  function updateRegistrationField(field: keyof typeof emptyRegistration, value: string) {
    if (field === "student_id") {
      const selectedStudent = students.find((student) => student.id === value);
      setRegistrationCategories([]);
      setRegistrationForm((current) => ({
        ...current,
        student_id: value,
        school_id: selectedStudent?.school_id || school?.id || "",
        category: "",
      }));
      return;
    }

    if (field === "tournament_id") {
      setRegistrationCategories([]);
      setRegistrationForm((current) => ({ ...current, tournament_id: value, category: "" }));
      return;
    }

    setRegistrationForm((current) => ({ ...current, [field]: value }));
  }

  function toggleRegistrationCategory(category: string, checked: boolean) {
    setRegistrationCategories((current) =>
      checked ? [...new Set([...current, category])] : current.filter((item) => item !== category),
    );
    setRegistrationForm((current) => ({
      ...current,
      category: checked ? category : current.category === category ? "" : current.category,
    }));
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

  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(
      editingResultId ? `/api/tournament-entries/${editingResultId}` : "/api/tournament-entries",
      {
        method: editingResultId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(resultForm),
      },
    );
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save tournament result.");
      return;
    }

    setEditingResultId("");
    setResultForm({
      ...emptyResult,
      tournament_id: tournaments[0]?.id || "",
      student_id: students[0]?.id || "",
      school_id: students[0]?.school_id || school?.id || "",
    });
    await loadAll(token);
  }

  function editResult(entry: TournamentEntry) {
    setEditingResultId(entry.id);
    setResultForm({
      tournament_id: entry.tournament_id,
      student_id: entry.student_id,
      school_id: entry.school_id,
      category: entry.category ?? "",
      medal: entry.medal ?? "participation",
      result_label: entry.result_label ?? "",
      status: entry.status,
    });
  }

  async function saveRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const categoriesToRegister = editingRegistrationId
      ? [registrationForm.category].filter(Boolean)
      : registrationCategories.filter(
          (category) =>
            !entries.some(
              (entry) =>
                entry.tournament_id === registrationForm.tournament_id &&
                entry.student_id === registrationForm.student_id &&
                entry.category === category,
            ),
        );

    if (categoriesToRegister.length === 0) {
      setBusy(false);
      setError(editingRegistrationId ? "Select a tournament event." : "Select at least one new tournament event for this student.");
      return;
    }

    const responses = await Promise.all(
      categoriesToRegister.map(async (category) => {
        const response = await fetch(
          editingRegistrationId ? `/api/tournament-entries/${editingRegistrationId}` : "/api/tournament-entries",
          {
            method: editingRegistrationId ? "PATCH" : "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              ...registrationForm,
              category,
              medal: "",
              result_label: "",
              status: "registered",
            }),
          },
        );

        return {
          ok: response.ok,
          payload: await response.json(),
        };
      }),
    );
    setBusy(false);

    const failedResponse = responses.find((response) => !response.ok);

    if (failedResponse) {
      setError(failedResponse.payload.error ?? "Unable to save tournament registration.");
      return;
    }

    setEditingRegistrationId("");
    setRegistrationCategories([]);
    setRegistrationForm({
      ...emptyRegistration,
      tournament_id: registrationForm.tournament_id || tournaments[0]?.id || "",
      student_id: students[0]?.id || "",
      school_id: students[0]?.school_id || school?.id || "",
    });
    await loadAll(token);
  }

  function startRegistration(tournament: Tournament) {
    setEditingRegistrationId("");
    setRegistrationCategories([]);
    setRegistrationForm((current) => ({
      ...emptyRegistration,
      tournament_id: tournament.id,
      student_id: current.student_id || students[0]?.id || "",
      school_id: current.school_id || students[0]?.school_id || school?.id || "",
    }));
    window.setTimeout(() => registrationFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function editRegistration(entry: TournamentEntry) {
    setEditingRegistrationId(entry.id);
    setRegistrationCategories(entry.category ? [entry.category] : []);
    setRegistrationForm({
      tournament_id: entry.tournament_id,
      student_id: entry.student_id,
      school_id: entry.school_id,
      category: entry.category ?? "",
      medal: "",
      result_label: "",
      status: "registered",
    });
    window.setTimeout(() => registrationFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function deleteRegistration(entryId: string) {
    setBusy(true);
    setError("");

    const response = await fetch(`/api/tournament-entries/${entryId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete tournament registration.");
      return;
    }

    await loadAll(token);
  }

  const sectionTitle = {
    overview: school?.name ?? "My school",
    details: "School information",
    instructors: "Instructors",
    compliance: "Compliance documents",
    results: "Tournament results",
    tournaments: "Tournament registration",
  }[section];

  const sectionDescription = {
    overview: "Update school details, instructor training, compliance, and tournament results.",
    details: "Update your school contact and registration information.",
    instructors: "Manage instructor details, certification, and training status.",
    compliance: "Record safeguarding, first aid, NQF, and instructor training documents.",
    results: "Add entries and results for your school's students.",
    tournaments: "Register your school students for upcoming tournaments.",
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

  function formatTournamentDate(value: string) {
    return new Date(value).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const upcomingTournaments = tournaments
    .filter((tournament) => new Date(tournament.starts_at).getTime() >= todayTimestamp)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const resultGroups = tournaments
    .map((tournament) => {
      const tournamentEntries = entries.filter((entry) => entry.tournament_id === tournament.id);

      return {
        tournament,
        entries: tournamentEntries,
        points: tournamentEntries.reduce((total, entry) => total + Number(entry.points ?? 0), 0),
      };
    })
    .filter((group) => group.entries.length > 0);

  const registrationGroups = tournaments
    .map((tournament) => {
      const tournamentEntries = entries.filter((entry) => entry.tournament_id === tournament.id);

      return {
        tournament,
        entries: tournamentEntries,
      };
    })
    .filter((group) => group.entries.length > 0);

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
                <div>
                  <h2>{instructor.full_name}</h2>
                  <dl className="detail-grid">
                    <div><dt>Rank</dt><dd>{instructor.rank ?? instructor.certification_level ?? "No rank"}</dd></div>
                    <div><dt>Collar</dt><dd>{instructor.collar_level ?? "Not recorded"}</dd></div>
                    <div><dt>Training</dt><dd>{instructor.training_status}</dd></div>
                    <div><dt>Certified</dt><dd>{instructor.certification_date ?? instructor.training_expires_at ?? "Not recorded"}</dd></div>
                  </dl>
                </div>
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
                  <dl className="detail-grid">
                    <div><dt>Owner</dt><dd>{item.owner}</dd></div>
                    <div><dt>Status</dt><dd>{item.document?.status ?? "Outstanding"}</dd></div>
                    <div><dt>File</dt><dd>{item.document?.file_name ?? "No file submitted"}</dd></div>
                  </dl>
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
            <p className="small-note">New and updated documents are submitted for admin review.</p>
            <label>Expiry<input type="date" value={documentForm.expires_at} onChange={(event) => updateDocumentField("expires_at", event.target.value)} /></label>
            <button className="primary-button compact" disabled={busy || !school} type="submit">{editingDocumentId ? "Save document" : "Add document"}</button>
          </form>

          <section className="table-list">
            {documents.map((document) => (
              <article className="list-row" key={document.id}>
                <div>
                  <h2>{document.document_name}</h2>
                  <dl className="detail-grid">
                    <div><dt>Requirement</dt><dd>{document.compliance_requirements?.name ?? "General"}</dd></div>
                    <div><dt>Status</dt><dd>{document.status}</dd></div>
                    <div><dt>File</dt><dd>{document.file_name ?? "No file"}</dd></div>
                    <div><dt>Expiry</dt><dd>{document.expires_at ?? "No expiry"}</dd></div>
                  </dl>
                </div>
                <button className="secondary-button compact" onClick={() => editDocument(document)} type="button">Edit</button>
              </article>
            ))}
          </section>
        </section>
      </main>
    );
  }

  if (section === "results") {
    return (
      <main className="app-page">
        {renderHeader()}
        {errorBlock}
        <section className="section-title">
          <h2>Upcoming tournaments</h2>
          <p>Tournaments open to schools for entries and results.</p>
        </section>
        <section className="tournament-card-grid">
          {upcomingTournaments.length === 0 ? (
            <article className="empty-state">No upcoming tournaments recorded yet.</article>
          ) : (
            upcomingTournaments.map((tournament) => (
              <article className="tournament-card" key={tournament.id}>
                <div className="tournament-card-header">
                  <div>
                    <h2>{tournament.name}</h2>
                    <p>{tournament.venue ?? "No venue"}</p>
                  </div>
                  <span className="status-pill">{tournament.provinces?.name ?? "National"}</span>
                </div>
                <dl className="tournament-mini-grid">
                  <div><dt>Date</dt><dd>{formatTournamentDate(tournament.starts_at)}</dd></div>
                  <div><dt>Entries close</dt><dd>{tournament.registration_closes_at ? formatTournamentDate(tournament.registration_closes_at) : "Not set"}</dd></div>
                </dl>
              </article>
            ))
          )}
        </section>

        <section className="section-title">
          <h2>{editingResultId ? "Edit result" : "Add result"}</h2>
          <p>Select a tournament and student, then record the category and result.</p>
        </section>
        <form className="admin-form content-shell" onSubmit={saveResult}>
          <label>Tournament<select value={resultForm.tournament_id} onChange={(event) => updateResultField("tournament_id", event.target.value)} required>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
          <label>Student<select value={resultForm.student_id} onChange={(event) => updateResultField("student_id", event.target.value)} required>{students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}</select></label>
          <label>Category<select value={resultForm.category} onChange={(event) => updateResultField("category", event.target.value)} required><option value="">Select category</option>{tournamentCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label>Result<select value={resultForm.medal} onChange={(event) => updateResultField("medal", event.target.value)}>{tournamentResults.map((result) => <option key={result} value={result}>{result}</option>)}</select></label>
          <p className="small-note">Points will be calculated automatically: {tournamentPointsForResult(resultForm.medal) ?? 0} points.</p>
          <label>Result note<input value={resultForm.result_label} onChange={(event) => updateResultField("result_label", event.target.value)} /></label>
          <button className="primary-button compact" disabled={busy || tournaments.length === 0 || students.length === 0} type="submit">{editingResultId ? "Save result" : "Add result"}</button>
        </form>

        <section className="section-title">
          <h2>Your results by tournament</h2>
          <p>Open a tournament to see and edit your school&apos;s recorded results.</p>
        </section>
        <section className="tournament-accordion-list">
          {resultGroups.length === 0 ? (
            <article className="empty-state">No tournament results recorded for your school yet.</article>
          ) : (
            resultGroups.map(({ tournament, entries: tournamentEntries, points }, index) => (
              <details className="tournament-group" key={tournament.id} open={index === 0}>
                <summary>
                  <span>
                    <strong>{tournament.name}</strong>
                    <small>{formatTournamentDate(tournament.starts_at)} | {tournament.venue ?? "No venue"}</small>
                  </span>
                  <span className="tournament-summary-counts">
                    <b>{tournamentEntries.length}</b> entries
                    <b>{points}</b> points
                  </span>
                </summary>
                <div className="responsive-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Rank</th>
                        <th>Category</th>
                        <th>Result</th>
                        <th>Points</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournamentEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.students?.first_name} {entry.students?.last_name}</td>
                          <td>{entry.students?.belt_rank ?? "No rank"}</td>
                          <td>{entry.category ?? "No category"}</td>
                          <td>{entry.result_label || entry.medal || "Entered"}</td>
                          <td>{entry.points ?? 0}</td>
                          <td><button className="secondary-button compact" onClick={() => editResult(entry)} type="button">Edit</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))
          )}
        </section>
      </main>
    );
  }

  if (section === "tournaments") {
    return (
      <main className="app-page">
        {renderHeader()}
        {errorBlock}
        <section className="section-title">
          <h2>Upcoming tournaments</h2>
          <p>Select a tournament to register students and categories.</p>
        </section>
        <section className="tournament-card-grid">
          {upcomingTournaments.length === 0 ? (
            <article className="empty-state">No upcoming tournaments recorded yet.</article>
          ) : (
            upcomingTournaments.map((tournament) => (
              <article className="tournament-card" key={tournament.id}>
                <div className="tournament-card-header">
                  <div>
                    <h2>{tournament.name}</h2>
                    <p>{tournament.venue ?? "No venue"}</p>
                  </div>
                  <span className="status-pill">{tournament.provinces?.name ?? "National"}</span>
                </div>
                <dl className="tournament-mini-grid">
                  <div><dt>Date</dt><dd>{formatTournamentDate(tournament.starts_at)}</dd></div>
                  <div><dt>Entries close</dt><dd>{tournament.registration_closes_at ? formatTournamentDate(tournament.registration_closes_at) : "Not set"}</dd></div>
                </dl>
                <button className="secondary-button compact" disabled={students.length === 0} onClick={() => startRegistration(tournament)} type="button">
                  Register students
                </button>
              </article>
            ))
          )}
        </section>

        <section className="section-title">
          <h2>{editingRegistrationId ? "Edit registration" : "Register student"}</h2>
          <p>Choose one student, then select every tournament event/category they will enter.</p>
        </section>
        <form className="admin-form content-shell" onSubmit={saveRegistration} ref={registrationFormRef}>
          <label>Tournament<select value={registrationForm.tournament_id} onChange={(event) => updateRegistrationField("tournament_id", event.target.value)} required>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
          <label>Student<select value={registrationForm.student_id} onChange={(event) => updateRegistrationField("student_id", event.target.value)} required>{students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}</select></label>
          {editingRegistrationId ? (
            <label>Tournament event<select value={registrationForm.category} onChange={(event) => updateRegistrationField("category", event.target.value)} required><option value="">Select event</option>{tournamentCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          ) : (
            <fieldset style={{ border: "1px solid #d9dee7", borderRadius: 8, display: "grid", gap: 12, gridColumn: "1 / -1", padding: 16 }}>
              <legend style={{ fontWeight: 800, padding: "0 6px" }}>Tournament events</legend>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {tournamentCategories.map((category) => {
                  const alreadyRegistered = entries.some(
                    (entry) =>
                      entry.tournament_id === registrationForm.tournament_id &&
                      entry.student_id === registrationForm.student_id &&
                      entry.category === category,
                  );

                  return (
                    <label className="checkbox-label" key={category} style={{ border: "1px solid #d9dee7", borderRadius: 8, padding: 10 }}>
                      <input
                        checked={registrationCategories.includes(category)}
                        disabled={alreadyRegistered}
                        onChange={(event) => toggleRegistrationCategory(category, event.target.checked)}
                        type="checkbox"
                      />
                      {category}{alreadyRegistered ? " (already registered)" : ""}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <button className="primary-button compact" disabled={busy || tournaments.length === 0 || students.length === 0 || (!editingRegistrationId && registrationCategories.length === 0)} type="submit">{editingRegistrationId ? "Save registration" : "Register selected events"}</button>
          {editingRegistrationId ? (
            <button className="secondary-button compact" onClick={() => { setEditingRegistrationId(""); setRegistrationCategories([]); }} type="button">Cancel edit</button>
          ) : null}
        </form>

        <section className="section-title">
          <h2>Your tournament registrations</h2>
          <p>Open a tournament to review your school&apos;s registered students and recorded results.</p>
        </section>
        <section className="tournament-accordion-list">
          {registrationGroups.length === 0 ? (
            <article className="empty-state">No tournament registrations recorded for your school yet.</article>
          ) : (
            registrationGroups.map(({ tournament, entries: tournamentEntries }, index) => (
              <details className="tournament-group" key={tournament.id} open={index === 0}>
                <summary>
                  <span>
                    <strong>{tournament.name}</strong>
                    <small>{formatTournamentDate(tournament.starts_at)} | {tournament.venue ?? "No venue"}</small>
                  </span>
                  <span className="tournament-summary-counts">
                    <b>{tournamentEntries.length}</b> registrations
                  </span>
                </summary>
                <div className="responsive-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Rank</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Result</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournamentEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.students?.first_name} {entry.students?.last_name}</td>
                          <td>{entry.students?.belt_rank ?? "No rank"}</td>
                          <td>{entry.category ?? "No category"}</td>
                          <td>{entry.status}</td>
                          <td>{entry.medal ? `${entry.medal} (${entry.points ?? 0} pts)` : "Pending result"}</td>
                          <td>
                            <div className="row-actions">
                              <button className="secondary-button compact" onClick={() => editRegistration(entry)} type="button">Edit</button>
                              <button className="danger-button compact" disabled={busy} onClick={() => deleteRegistration(entry.id)} type="button">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))
          )}
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
            <p className="small-note">New and updated documents are submitted for admin review.</p>
          <label>Expiry<input type="date" value={documentForm.expires_at} onChange={(event) => updateDocumentField("expires_at", event.target.value)} /></label>
          <button className="primary-button compact" disabled={busy || !school} type="submit">{editingDocumentId ? "Save document" : "Add document"}</button>
        </form>
        <section className="table-list">
          {documents.map((document) => (
            <article className="list-row" key={document.id}>
              <div>
                <h2>{document.document_name}</h2>
                <dl className="detail-grid">
                  <div><dt>Requirement</dt><dd>{document.compliance_requirements?.name ?? "General"}</dd></div>
                  <div><dt>Status</dt><dd>{document.status}</dd></div>
                  <div><dt>File</dt><dd>{document.file_name ?? "No file"}</dd></div>
                  <div><dt>Expiry</dt><dd>{document.expires_at ?? "No expiry"}</dd></div>
                </dl>
              </div>
              <button className="secondary-button compact" onClick={() => editDocument(document)} type="button">Edit</button>
            </article>
          ))}
        </section>
      </section>

      <section className="section-title results-block"><h2>Tournament Results</h2><p>Add entries and results for your school&apos;s students.</p></section>
      <section className="two-column-workspace results-block">
        <form className="admin-form" onSubmit={saveResult}>
          <h2>{editingResultId ? "Edit result" : "Add result"}</h2>
          <label>Tournament<select value={resultForm.tournament_id} onChange={(event) => updateResultField("tournament_id", event.target.value)} required>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
          <label>Student<select value={resultForm.student_id} onChange={(event) => updateResultField("student_id", event.target.value)} required>{students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}</select></label>
          <label>Category<select value={resultForm.category} onChange={(event) => updateResultField("category", event.target.value)} required><option value="">Select category</option>{tournamentCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label>Result<select value={resultForm.medal} onChange={(event) => updateResultField("medal", event.target.value)}>{tournamentResults.map((result) => <option key={result} value={result}>{result}</option>)}</select></label>
          <p className="small-note">Points will be calculated automatically: {tournamentPointsForResult(resultForm.medal) ?? 0} points.</p>
          <label>Result note<input value={resultForm.result_label} onChange={(event) => updateResultField("result_label", event.target.value)} /></label>
          <button className="primary-button compact" disabled={busy || tournaments.length === 0 || students.length === 0} type="submit">{editingResultId ? "Save result" : "Add result"}</button>
        </form>
        <section className="table-list">
          {entries.map((entry) => (
            <article className="list-row" key={entry.id}>
              <div>
                <h2>{entry.students?.first_name} {entry.students?.last_name}</h2>
                <dl className="detail-grid">
                  <div><dt>Tournament</dt><dd>{entry.tournaments?.name ?? "Tournament"}</dd></div>
                  <div><dt>Category</dt><dd>{entry.category ?? "No category"}</dd></div>
                  <div><dt>Result</dt><dd>{entry.result_label || entry.medal || "Entered"}</dd></div>
                  <div><dt>Points</dt><dd>{entry.points ?? 0}</dd></div>
                </dl>
              </div>
              <button className="secondary-button compact" onClick={() => editResult(entry)} type="button">Edit</button>
            </article>
          ))}
        </section>
      </section>

      <section className="section-title instructor-list-block"><h2>Instructors</h2></section>
      <section className="content-shell table-list instructor-list-block">
        {instructors.map((instructor) => (
          <article className="list-row" key={instructor.id}>
            <div>
              <h2>{instructor.full_name}</h2>
              <dl className="detail-grid">
                <div><dt>Rank</dt><dd>{instructor.rank ?? instructor.certification_level ?? "No rank"}</dd></div>
                <div><dt>Collar</dt><dd>{instructor.collar_level ?? "Not recorded"}</dd></div>
                <div><dt>Training</dt><dd>{instructor.training_status}</dd></div>
                <div><dt>Certified</dt><dd>{instructor.certification_date ?? instructor.training_expires_at ?? "Not recorded"}</dd></div>
              </dl>
            </div>
            <button className="secondary-button compact" onClick={() => editInstructor(instructor)} type="button">Edit</button>
          </article>
        ))}
      </section>
    </main>
  );
}

