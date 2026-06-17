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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadRequirements(activeToken: string) {
    const params = new URLSearchParams(window.location.search);
    const schoolId = params.get("school_id");
    const response = await fetch(schoolId ? `/api/admin/compliance?school_id=${encodeURIComponent(schoolId)}` : "/api/admin/compliance", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load compliance requirements.");
      return;
    }

    setRequirements(payload.requirements);
    setDocuments(payload.documents ?? []);
    setSchools(payload.schools ?? []);
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
  }, []);

  function updateField(field: keyof typeof emptyRequirement, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
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
        {documents.length === 0 ? (
          <article className="empty-state">No compliance documents submitted yet.</article>
        ) : (
          documents.map((document) => (
            <article className="list-row" key={document.id}>
              <div>
                <h2>{document.document_name}</h2>
                <p>
                  {document.schools?.name ?? "No school"} | {document.compliance_requirements?.name ?? "General"} | {document.status} | {document.expires_at ?? "no expiry"}
                </p>
              </div>
              {document.file_name ? <span className="status-pill">{document.file_name}</span> : null}
            </article>
          ))
        )}
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
                <p>{requirement.category} | {requirement.applies_to} | {requirement.renewal_period_months ?? "no"} month renewal</p>
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
