"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Province, School } from "@/lib/types";

const schoolCardStyle = {
  display: "grid",
  gap: "18px",
  padding: "22px",
  background: "#ffffff",
  border: "2px solid #d9dee7",
  borderLeft: "8px solid #0f766e",
  borderRadius: "8px",
  boxShadow: "0 18px 38px rgba(15, 23, 42, 0.1)",
} satisfies React.CSSProperties;

const schoolHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "76px minmax(0, 1fr) auto",
  alignItems: "start",
  gap: "16px",
  paddingBottom: "16px",
  borderBottom: "1px solid #d9dee7",
} satisfies React.CSSProperties;

const logoSlotStyle = {
  width: "76px",
  height: "76px",
  display: "grid",
  placeItems: "center",
  background: "#eef2f7",
  border: "2px dashed #94a3b8",
  borderRadius: "8px",
  color: "#475569",
  fontWeight: 900,
  overflow: "hidden",
} satisfies React.CSSProperties;

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
  gap: "12px",
} satisfies React.CSSProperties;

const metricStyle = {
  display: "grid",
  gap: "5px",
  height: "96px",
  padding: "14px",
  background: "#f8fafc",
  border: "1px solid #d9dee7",
  borderRadius: "8px",
} satisfies React.CSSProperties;

const affiliationStatuses = ["pending", "active", "suspended", "expired"];

const emptySchool = {
  province_id: "",
  name: "",
  registration_number: "",
  city: "",
  address: "",
  contact_email: "",
  contact_phone: "",
  logo_url: "",
  affiliation_status: "pending",
};

const emptyEmail = {
  subject: "NMAA SA Portal Update",
  message: "",
};

function raceSummary(raceCounts?: Record<string, number>) {
  if (!raceCounts || Object.keys(raceCounts).length === 0) {
    return "Race: no data";
  }

  return Object.entries(raceCounts)
    .map(([race, count]) => `${race}: ${count}`)
    .join(" | ");
}

function schoolInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function schoolEmailCount(schools: School[]) {
  const emails = Array.from(
    new Set(
      schools
        .map((school) => school.contact_email?.trim())
        .filter((email): email is string => Boolean(email)),
    ),
  );

  return emails.length;
}

export default function SchoolsClient() {
  const [token, setToken] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptySchool);
  const [emailForm, setEmailForm] = useState(emptyEmail);
  const [selectedEmailSchoolIds, setSelectedEmailSchoolIds] = useState<string[]>([]);
  const [emailSuccess, setEmailSuccess] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [filters, setFilters] = useState({ search: "", province_id: "", status: "" });
  const [pagination, setPagination] = useState({ page: 1, page_size: 25, total: 0, has_more: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formSectionRef = useRef<HTMLElement | null>(null);

  async function loadSchools(activeToken: string, page = 1, append = false) {
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("page_size", "25");
    if (filters.search) query.set("search", filters.search);
    if (filters.province_id) query.set("province_id", filters.province_id);
    if (filters.status) query.set("status", filters.status);

    const response = await fetch(`/api/admin/schools?${query.toString()}`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load schools.");
      return;
    }

    setSchools((current) => (append ? [...current, ...payload.schools] : payload.schools));
    setProvinces(payload.provinces);
    setPagination(payload.pagination ?? { page, page_size: 25, total: payload.schools.length, has_more: false });
    setSelectedEmailSchoolIds((current) => current.filter((schoolId) => payload.schools.some((school: School) => school.id === schoolId)));
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/schools";
        return;
      }

      setToken(activeToken);
      await loadSchools(activeToken);
    }

    loadSession();
  }, []);

  function updateField(field: keyof typeof emptySchool, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEmailField(field: keyof typeof emptyEmail, value: string) {
    setEmailForm((current) => ({ ...current, [field]: value }));
  }

  function updateFilter(field: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function toggleEmailSchool(schoolId: string) {
    setSelectedEmailSchoolIds((current) =>
      current.includes(schoolId)
        ? current.filter((id) => id !== schoolId)
        : [...current, schoolId],
    );
  }

  function selectAllEmailSchools() {
    setSelectedEmailSchoolIds(schools.filter((school) => school.contact_email).map((school) => school.id));
  }

  function clearEmailSchools() {
    setSelectedEmailSchoolIds([]);
  }

  function resetForm() {
    setEditingId("");
    setForm(emptySchool);
  }

  function editSchool(school: School) {
    setEditingId(school.id);
    setForm({
      province_id: school.province_id,
      name: school.name,
      registration_number: school.registration_number ?? "",
      city: school.city ?? "",
      address: school.address ?? "",
      contact_email: school.contact_email ?? "",
      contact_phone: school.contact_phone ?? "",
      logo_url: school.logo_url ?? "",
      affiliation_status: school.affiliation_status,
    });
    window.setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function saveSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(editingId ? `/api/admin/schools/${editingId}` : "/api/admin/schools", {
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
      setError(payload.error ?? "Unable to save school.");
      return;
    }

    resetForm();
    await loadSchools(token);
  }

  async function sendSchoolEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setEmailSuccess("");

    const response = await fetch("/api/admin/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...emailForm,
        school_ids: selectedEmailSchoolIds,
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to send email.");
      return;
    }

    setEmailSuccess(`Email sent to ${payload.recipient_count} school contact${payload.recipient_count === 1 ? "" : "s"}.`);
    setEmailForm(emptyEmail);
  }

  async function deleteSchool(schoolId: string) {
    setBusy(true);
    setError("");

    const response = await fetch(`/api/admin/schools/${schoolId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete school.");
      return;
    }

    await loadSchools(token);
  }

  function cardStyleForStatus(status: string) {
    if (status === "pending") return { ...schoolCardStyle, borderLeft: "8px solid #d97706" };
    if (status === "suspended" || status === "expired") return { ...schoolCardStyle, borderLeft: "8px solid #b42318" };
    return schoolCardStyle;
  }

  const emailCount = schoolEmailCount(schools);
  const selectedEmailCount = selectedEmailSchoolIds.length;

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>Schools</h1>
          <p className="muted">Quickly review school status, student stats, and compliance health.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      <section className="content-shell">
        <div className="admin-form">
          <h2>Find schools</h2>
          <label>Search<input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="School, city, or email" /></label>
          <label>Province<select value={filters.province_id} onChange={(event) => updateFilter("province_id", event.target.value)}><option value="">All provinces</option>{provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</select></label>
          <label>Status<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{affiliationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <div className="row-actions">
            <button className="primary-button compact" onClick={() => loadSchools(token)} type="button">Apply filters</button>
            <button className="secondary-button compact" onClick={() => { setFilters({ search: "", province_id: "", status: "" }); window.setTimeout(() => loadSchools(token), 0); }} type="button">Clear</button>
          </div>
          <p className="small-note">Showing {schools.length} of {pagination.total} schools.</p>
        </div>
      </section>

      <section className="content-shell">
        <section className="admin-form">
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <div>
              <h2>Email schools</h2>
              <p className="muted">
                Send a direct email to selected schools from the portal.
              </p>
            </div>
            <button className="secondary-button compact" onClick={() => setEmailOpen((current) => !current)} type="button">
              {emailOpen ? "Hide email form" : "Open email form"}
            </button>
          </div>
          {emailOpen ? (
            <form className="stack-form" onSubmit={sendSchoolEmail}>
              <section className="stat-panel">
                <div className="row-actions" style={{ justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Recipients</h3>
                    <p className="muted">
                      {selectedEmailCount === 0
                        ? `No schools selected. This will send to all ${emailCount} school contact${emailCount === 1 ? "" : "s"}.`
                        : `${selectedEmailCount} school${selectedEmailCount === 1 ? "" : "s"} selected.`}
                    </p>
                  </div>
                  <div className="row-actions">
                    <button className="secondary-button compact" onClick={selectAllEmailSchools} type="button">Select all</button>
                    <button className="secondary-button compact" onClick={clearEmailSchools} type="button">Clear</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                  {schools.map((school) => (
                    <label className="checkbox-label" key={school.id} style={{ padding: 10, border: "1px solid #d9dee7", borderRadius: 8 }}>
                      <input
                        checked={selectedEmailSchoolIds.includes(school.id)}
                        disabled={!school.contact_email}
                        onChange={() => toggleEmailSchool(school.id)}
                        type="checkbox"
                      />
                      <span>{school.name}{school.contact_email ? "" : " - no email"}</span>
                    </label>
                  ))}
                </div>
              </section>
              <label>
                Subject
                <input value={emailForm.subject} onChange={(event) => updateEmailField("subject", event.target.value)} required />
              </label>
              <label>
                Message
                <textarea className="order-summary-text" rows={6} value={emailForm.message} onChange={(event) => updateEmailField("message", event.target.value)} required />
              </label>
              {emailSuccess ? <p className="form-success">{emailSuccess}</p> : null}
              {error ? <p className="form-error">{error}</p> : null}
              <button className="primary-button compact" disabled={busy || emailCount === 0} type="submit">
                Send email to schools
              </button>
            </form>
          ) : emailSuccess ? (
            <p className="form-success">{emailSuccess}</p>
          ) : null}
        </section>
      </section>

      <section className="content-shell table-list">
        {schools.map((school) => (
          <article
            className={`school-overview-card status-${school.affiliation_status}`}
            key={school.id}
            style={cardStyleForStatus(school.affiliation_status)}
          >
            <div className="school-overview-header" style={schoolHeaderStyle}>
              <div className="school-logo-slot" style={logoSlotStyle} aria-label={`${school.name} logo placeholder`}>
                {school.logo_url ? (
                  <img className="school-card-logo" src={school.logo_url} alt={`${school.name} logo`} />
                ) : (
                  <span>{schoolInitials(school.name) || "NMAA"}</span>
                )}
              </div>
              <div>
                <h2>{school.name}</h2>
                <dl className="detail-grid">
                  <div><dt>Province</dt><dd>{school.provinces?.name ?? "No province"}</dd></div>
                  <div><dt>City</dt><dd>{school.city ?? "No city"}</dd></div>
                </dl>
                <span className={`status-pill status-${school.affiliation_status}`}>{school.affiliation_status}</span>
              </div>
              <div className="row-actions">
                <button className="secondary-button compact" onClick={() => editSchool(school)} type="button">
                  Edit details
                </button>
                <button className="danger-button compact" disabled={busy} onClick={() => deleteSchool(school.id)} type="button">
                  Delete
                </button>
              </div>
            </div>
            <div className="school-metric-grid" style={metricGridStyle}>
              <Link className="school-metric metric-link" href={`/students?school_id=${school.id}`} style={metricStyle}><strong>{school.student_count ?? 0}</strong><span>Total students</span></Link>
              <Link className="school-metric metric-link" href={`/instructors?school_id=${school.id}`} style={metricStyle}><strong>{school.instructor_count ?? 0}</strong><span>Instructors</span></Link>
              <Link className="school-metric metric-link" href={`/students?school_id=${school.id}`} style={metricStyle}><strong>{school.male_student_count ?? 0}</strong><span>Male</span></Link>
              <Link className="school-metric metric-link" href={`/students?school_id=${school.id}`} style={metricStyle}><strong>{school.female_student_count ?? 0}</strong><span>Female</span></Link>
              <Link className="school-metric metric-link race-metric" href={`/students?school_id=${school.id}`} style={metricStyle}><strong>Race</strong><span>{raceSummary(school.race_counts).replace("Race: ", "")}</span></Link>
              <Link className="school-metric metric-link" href={`/students?school_id=${school.id}`} style={metricStyle}><strong>{school.little_dragons_count ?? 0}</strong><span>Little Dragons 4-6</span></Link>
              <Link className="school-metric metric-link" href={`/students?school_id=${school.id}`} style={metricStyle}><strong>{school.karate_kids_count ?? 0}</strong><span>Karate Kids 7-12</span></Link>
              <Link className="school-metric metric-link" href={`/students?school_id=${school.id}`} style={metricStyle}><strong>{school.teens_adults_count ?? 0}</strong><span>Teens and Adults 13+</span></Link>
              <Link className="school-metric metric-link" href={`/admin/compliance?school_id=${school.id}`} style={metricStyle}><strong>{school.submitted_compliance_count ?? 0}</strong><span>Documents submitted</span></Link>
              <Link className="school-metric metric-link warning" href={`/admin/compliance?school_id=${school.id}`} style={{ ...metricStyle, background: "#fffaeb", borderColor: "#fedf89" }}><strong>{school.outstanding_compliance_count ?? 0}</strong><span>Outstanding compliance</span></Link>
              <Link className="school-metric metric-link danger" href={`/admin/compliance?school_id=${school.id}`} style={{ ...metricStyle, background: "#fff4f2", borderColor: "#fecdca" }}><strong>{school.expired_compliance_count ?? 0}</strong><span>Expired compliance</span></Link>
            </div>
          </article>
        ))}
      </section>
      {pagination.has_more ? (
        <section className="content-shell">
          <button className="secondary-button" disabled={busy} onClick={() => loadSchools(token, pagination.page + 1, true)} type="button">Load more schools</button>
        </section>
      ) : null}

      <section className="section-title">
        <h2>{editingId ? "Edit school" : "Add school"}</h2>
        <p>New schools are added occasionally, so this form lives below the overview.</p>
      </section>
      <section className="content-shell" ref={formSectionRef}>
        <form className="admin-form" onSubmit={saveSchool}>
          <h2>{editingId ? "Edit school" : "Add school"}</h2>
          <label>
            School name
            <input value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
          </label>
          <label>
            Province
            <select value={form.province_id} onChange={(event) => updateField("province_id", event.target.value)} required>
              <option value="">Select province</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>{province.name}</option>
              ))}
            </select>
          </label>
          <label>
            Registration number
            <input value={form.registration_number} onChange={(event) => updateField("registration_number", event.target.value)} />
          </label>
          <label>
            City
            <input value={form.city} onChange={(event) => updateField("city", event.target.value)} />
          </label>
          <label>
            Address
            <input value={form.address} onChange={(event) => updateField("address", event.target.value)} />
          </label>
          <label>
            Contact email
            <input type="email" value={form.contact_email} onChange={(event) => updateField("contact_email", event.target.value)} />
          </label>
          <label>
            Contact phone
            <input value={form.contact_phone} onChange={(event) => updateField("contact_phone", event.target.value)} />
          </label>
          <label>
            Affiliation status
            <select value={form.affiliation_status} onChange={(event) => updateField("affiliation_status", event.target.value)}>
              {affiliationStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="row-actions">
            <button className="primary-button compact" disabled={busy} type="submit">
              {editingId ? "Save changes" : "Add school"}
            </button>
            {editingId ? (
              <button className="secondary-button compact" onClick={resetForm} type="button">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}
