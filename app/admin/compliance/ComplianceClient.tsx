"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { ComplianceDocument, ComplianceRequirement, School } from "@/lib/types";

const categories = ["safeguarding", "first_aid", "nqf_training", "instructor_training", "general"];
const appliesTo = ["school", "instructor", "student"];

const emptyRequirement = {
  name: "",
  description: "",
  category: "safeguarding",
  applies_to: "instructor",
  renewal_period_months: "12",
  active: true,
};

export default function ComplianceClient() {
  const [token, setToken] = useState("");
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [schools, setSchools] = useState<Pick<School, "id" | "name">[]>([]);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyRequirement);
  const [filters, setFilters] = useState({ search: "", school_id: "", status: "", category: "", expiry: "" });
  const [pagination, setPagination] = useState({ page: 1, page_size: 25, total: 0, has_more: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadRequirements(activeToken: string, page = 1, append = false) {
    const params = new URLSearchParams(window.location.search);
    const schoolId = params.get("school_id");
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("page_size", "25");
    if (schoolId || filters.school_id) query.set("school_id", schoolId || filters.school_id);
    if (filters.search) query.set("search", filters.search);
    if (filters.status) query.set("status", filters.status);
    if (filters.category) query.set("category", filters.category);
    if (filters.expiry) query.set("expiry", filters.expiry);
    const response = await fetch(`/api/admin/compliance?${query.toString()}`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load compliance requirements.");
      return;
    }

    setRequirements(payload.requirements);
    setDocuments((current) => (append ? [...current, ...(payload.documents ?? [])] : payload.documents ?? []));
    setSchools(payload.schools ?? []);
    setPagination(payload.pagination ?? { page, page_size: 25, total: payload.documents?.length ?? 0, has_more: false });
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/compliance";
        return;
      }

      setToken(activeToken);
      await loadRequirements(activeToken);
    }

    loadSession();
    // The initial session load should run once; filters reload through the page controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field: keyof typeof emptyRequirement, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateFilter(field: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyRequirement);
  }

  function editRequirement(requirement: ComplianceRequirement) {
    setEditingId(requirement.id);
    setForm({
      name: requirement.name,
      description: requirement.description ?? "",
      category: requirement.category,
      applies_to: requirement.applies_to,
      renewal_period_months: requirement.renewal_period_months?.toString() ?? "",
      active: requirement.active,
    });
  }

  async function saveRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(
      editingId ? `/api/admin/compliance/${editingId}` : "/api/admin/compliance",
      {
        method: editingId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      },
    );
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save requirement.");
      return;
    }

    resetForm();
    await loadRequirements(token);
  }

  async function deleteRequirement(requirementId: string) {
    setBusy(true);
    setError("");

    const response = await fetch(`/api/admin/compliance/${requirementId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete requirement.");
      return;
    }

    await loadRequirements(token);
  }

  async function downloadDocument(documentId: string) {
    setBusy(true);
    setError("");

    const response = await fetch(`/api/admin/compliance-documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to download compliance document.");
      return;
    }

    window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  async function updateDocumentStatus(documentId: string, status: string) {
    setBusy(true);
    setError("");

    const response = await fetch(`/api/admin/compliance-documents/${documentId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to update document status.");
      return;
    }

    await loadRequirements(token);
  }

  function documentOwner(document: ComplianceDocument) {
    if (document.instructors?.full_name) return document.instructors.full_name;
    if (document.students) return `${document.students.first_name} ${document.students.last_name}`;
    return document.schools?.name ?? "No owner recorded";
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>{schools.length === 1 ? `${schools[0].name} compliance` : "Compliance"}</h1>
          <p className="muted">Configure safeguarding, first aid, NQF, and instructor training requirements.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      <section className="content-shell table-list">
        <h2>Submitted documents</h2>
        <div className="admin-form">
          <h2>Find documents</h2>
          <label>Search<input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Document name" /></label>
          <label>School<select value={filters.school_id} onChange={(event) => updateFilter("school_id", event.target.value)}><option value="">All schools</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
          <label>Status<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option><option value="submitted">submitted</option><option value="approved">approved</option><option value="rejected">rejected</option><option value="expired">expired</option></select></label>
          <label>Category<select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label>Expiry<select value={filters.expiry} onChange={(event) => updateFilter("expiry", event.target.value)}><option value="">Any expiry</option><option value="expired">Expired</option><option value="next_30">Expiring in 30 days</option></select></label>
          <div className="row-actions">
            <button className="primary-button compact" onClick={() => loadRequirements(token)} type="button">Apply filters</button>
            <button className="secondary-button compact" onClick={() => { setFilters({ search: "", school_id: "", status: "", category: "", expiry: "" }); window.setTimeout(() => loadRequirements(token), 0); }} type="button">Clear</button>
          </div>
          <p className="small-note">Showing {documents.length} of {pagination.total} documents.</p>
        </div>
        {documents.length === 0 ? (
          <article className="empty-state">No compliance documents submitted yet.</article>
        ) : (
          documents.map((document) => (
            <article className="list-row" key={document.id}>
              <div>
                <h2>{document.document_name}</h2>
                <dl className="detail-grid">
                  <div><dt>Owner</dt><dd>{documentOwner(document)}</dd></div>
                  <div><dt>School</dt><dd>{document.schools?.name ?? "No school"}</dd></div>
                  <div><dt>Requirement</dt><dd>{document.compliance_requirements?.name ?? "General"}</dd></div>
                  <div><dt>Status</dt><dd>{document.status}</dd></div>
                  <div><dt>Expiry</dt><dd>{document.expires_at ?? "No expiry"}</dd></div>
                </dl>
              </div>
              <div className="row-actions">
                {document.file_name ? <span className="status-pill">{document.file_name}</span> : null}
                {document.storage_path ? (
                  <button className="secondary-button compact" disabled={busy} onClick={() => downloadDocument(document.id)} type="button">
                    Download
                  </button>
                ) : null}
                <button className="primary-button compact" disabled={busy} onClick={() => updateDocumentStatus(document.id, "approved")} type="button">Approve</button>
                <button className="secondary-button compact" disabled={busy} onClick={() => updateDocumentStatus(document.id, "submitted")} type="button">Mark submitted</button>
                <button className="danger-button compact" disabled={busy} onClick={() => updateDocumentStatus(document.id, "rejected")} type="button">Reject</button>
                <button className="danger-button compact" disabled={busy} onClick={() => updateDocumentStatus(document.id, "expired")} type="button">Expire</button>
              </div>
            </article>
          ))
        )}
        {pagination.has_more ? (
          <button className="secondary-button" disabled={busy} onClick={() => loadRequirements(token, pagination.page + 1, true)} type="button">Load more documents</button>
        ) : null}
      </section>

      <section className="admin-workspace">
        <form className="admin-form" onSubmit={saveRequirement}>
          <h2>{editingId ? "Edit requirement" : "Add requirement"}</h2>
          <label>
            Name
            <input value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
          </label>
          <label>
            Category
            <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Applies to
            <select value={form.applies_to} onChange={(event) => updateField("applies_to", event.target.value)}>
              {appliesTo.map((target) => (
                <option key={target} value={target}>{target}</option>
              ))}
            </select>
          </label>
          <label>
            Renewal months
            <input type="number" min="0" value={form.renewal_period_months} onChange={(event) => updateField("renewal_period_months", event.target.value)} />
          </label>
          <label>
            Description
            <input value={form.description} onChange={(event) => updateField("description", event.target.value)} />
          </label>
          <label className="checkbox-label">
            <input checked={form.active} onChange={(event) => updateField("active", event.target.checked)} type="checkbox" />
            Active
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="row-actions">
            <button className="primary-button compact" disabled={busy} type="submit">
              {editingId ? "Save changes" : "Add requirement"}
            </button>
            {editingId ? (
              <button className="secondary-button compact" onClick={resetForm} type="button">
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="table-list">
          {requirements.map((requirement) => (
            <article className="list-row" key={requirement.id}>
              <div>
                <h2>{requirement.name}</h2>
                <dl className="detail-grid">
                  <div><dt>Category</dt><dd>{requirement.category}</dd></div>
                  <div><dt>Applies to</dt><dd>{requirement.applies_to}</dd></div>
                  <div><dt>Renewal</dt><dd>{requirement.renewal_period_months ?? "No"} months</dd></div>
                </dl>
              </div>
              <div className="row-actions">
                <button className="secondary-button compact" onClick={() => editRequirement(requirement)} type="button">
                  Edit
                </button>
                <button className="danger-button compact" disabled={busy} onClick={() => deleteRequirement(requirement.id)} type="button">
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
