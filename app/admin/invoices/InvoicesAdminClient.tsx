"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { School, SchoolInvoice } from "@/lib/types";

type SchoolOption = Pick<School, "id" | "name" | "contact_email">;

const emptyInvoice = {
  school_id: "",
  invoice_number: "",
  title: "",
  description: "",
  amount_zar: "",
  status: "outstanding",
  due_date: "",
  admin_notes: "",
};

const emptyFilters = {
  search: "",
  school_id: "",
  status: "",
};

const invoiceStatuses = ["outstanding", "paid", "cancelled"];

function money(value: number | string | null) {
  return `R${Number(value ?? 0).toFixed(2)}`;
}

function dateLabel(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-ZA", { dateStyle: "medium" });
}

export default function InvoicesAdminClient() {
  const [token, setToken] = useState("");
  const [invoices, setInvoices] = useState<SchoolInvoice[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [form, setForm] = useState(emptyInvoice);
  const [filters, setFilters] = useState(emptyFilters);
  const [editingId, setEditingId] = useState("");
  const [pagination, setPagination] = useState({ page: 1, page_size: 25, total: 0, has_more: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const totals = useMemo(() => {
    return invoices.reduce(
      (summary, invoice) => {
        if (invoice.status === "outstanding") summary.outstanding += Number(invoice.amount_zar);
        if (invoice.status === "paid") summary.paid += Number(invoice.amount_zar);
        return summary;
      },
      { outstanding: 0, paid: 0 },
    );
  }, [invoices]);

  async function loadInvoices(activeToken: string, page = 1, append = false, activeFilters = filters) {
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("page_size", "25");
    if (activeFilters.search) query.set("search", activeFilters.search);
    if (activeFilters.school_id) query.set("school_id", activeFilters.school_id);
    if (activeFilters.status) query.set("status", activeFilters.status);

    const response = await fetch(`/api/admin/invoices?${query.toString()}`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load invoices.");
      setAccessDenied(response.status === 403);
      return;
    }

    setAccessDenied(false);
    setInvoices((current) => (append ? [...current, ...(payload.invoices ?? [])] : payload.invoices ?? []));
    setSchools(payload.schools ?? []);
    setPagination(payload.pagination ?? { page, page_size: 25, total: payload.invoices?.length ?? 0, has_more: false });
    setForm((current) => ({ ...current, school_id: current.school_id || payload.schools?.[0]?.id || "" }));
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/invoices";
        return;
      }

      setToken(activeToken);
      await loadInvoices(activeToken);
    }

    loadSession();
    // The initial session load should run once; filters reload through page controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field: keyof typeof emptyInvoice, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateFilter(field: keyof typeof emptyFilters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm({ ...emptyInvoice, school_id: schools[0]?.id || "" });
  }

  function editInvoice(invoice: SchoolInvoice) {
    setEditingId(invoice.id);
    setForm({
      school_id: invoice.school_id,
      invoice_number: invoice.invoice_number,
      title: invoice.title,
      description: invoice.description ?? "",
      amount_zar: String(invoice.amount_zar),
      status: invoice.status,
      due_date: invoice.due_date ?? "",
      admin_notes: invoice.admin_notes ?? "",
    });
    window.setTimeout(() => document.getElementById("invoice-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function saveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const response = await fetch(editingId ? `/api/admin/invoices/${editingId}` : "/api/admin/invoices", {
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
      setError(payload.error ?? "Unable to save invoice.");
      return;
    }

    setMessage(editingId ? "Invoice updated." : "Invoice created.");
    resetForm();
    await loadInvoices(token);
  }

  async function deleteInvoice(id: string) {
    setBusy(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/invoices/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete invoice.");
      return;
    }

    setMessage("Invoice deleted.");
    await loadInvoices(token);
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Super admin</p>
          <h1>School invoices</h1>
          <p className="muted">Add and manage private school-owner invoices.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}
      {message ? <section className="content-shell"><p className="success-message">{message}</p></section> : null}
      {accessDenied ? null : (
        <>

      <section className="stat-grid">
        <article><strong>{money(totals.outstanding)}</strong><span>Outstanding on this page</span></article>
        <article><strong>{money(totals.paid)}</strong><span>Paid on this page</span></article>
        <article><strong>{pagination.total}</strong><span>Total matching invoices</span></article>
      </section>

      <section className="section-title">
        <h2>{editingId ? "Edit invoice" : "Add invoice"}</h2>
        <p>Only super admins and the linked school owner can see these invoice records.</p>
      </section>
      <form className="admin-form content-shell" id="invoice-form" onSubmit={saveInvoice}>
        <label>School<select value={form.school_id} onChange={(event) => updateField("school_id", event.target.value)} required>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        <label>Invoice number<input value={form.invoice_number} onChange={(event) => updateField("invoice_number", event.target.value)} required /></label>
        <label>Title<input value={form.title} onChange={(event) => updateField("title", event.target.value)} required /></label>
        <label>Amount<input min="0" step="0.01" type="number" value={form.amount_zar} onChange={(event) => updateField("amount_zar", event.target.value)} required /></label>
        <label>Status<select value={form.status} onChange={(event) => updateField("status", event.target.value)}>{invoiceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label>Due date<input type="date" value={form.due_date} onChange={(event) => updateField("due_date", event.target.value)} /></label>
        <label>Description<textarea rows={3} value={form.description} onChange={(event) => updateField("description", event.target.value)} /></label>
        <label>Admin notes<textarea rows={3} value={form.admin_notes} onChange={(event) => updateField("admin_notes", event.target.value)} /></label>
        <div className="row-actions">
          <button className="primary-button compact" disabled={busy || schools.length === 0} type="submit">{editingId ? "Save invoice" : "Add invoice"}</button>
          {editingId ? <button className="secondary-button compact" onClick={resetForm} type="button">Cancel edit</button> : null}
        </div>
      </form>

      <section className="section-title">
        <h2>Find invoices</h2>
        <p>Filter by school or invoice status.</p>
      </section>
      <section className="content-shell table-list">
        <div className="admin-form">
          <label>Search<input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Invoice number or title" /></label>
          <label>School<select value={filters.school_id} onChange={(event) => updateFilter("school_id", event.target.value)}><option value="">All schools</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
          <label>Status<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{invoiceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <div className="row-actions">
            <button className="primary-button compact" onClick={() => loadInvoices(token)} type="button">Apply filters</button>
            <button className="secondary-button compact" onClick={() => { setFilters(emptyFilters); loadInvoices(token, 1, false, emptyFilters); }} type="button">Clear</button>
          </div>
          <p className="small-note">Showing {invoices.length} of {pagination.total} invoices.</p>
        </div>

        {invoices.length === 0 ? (
          <article className="empty-state">No invoices recorded yet.</article>
        ) : (
          invoices.map((invoice) => (
            <article className="list-row" key={invoice.id}>
              <div>
                <h2>{invoice.invoice_number} - {invoice.title}</h2>
                <dl className="detail-grid">
                  <div><dt>School</dt><dd>{invoice.schools?.name ?? "No school"}</dd></div>
                  <div><dt>Amount</dt><dd>{money(invoice.amount_zar)}</dd></div>
                  <div><dt>Due date</dt><dd>{dateLabel(invoice.due_date)}</dd></div>
                  <div><dt>Status</dt><dd><span className={`status-pill status-${invoice.status}`}>{invoice.status}</span></dd></div>
                </dl>
                {invoice.description ? <p className="muted">{invoice.description}</p> : null}
                {invoice.admin_notes ? <p className="small-note">Admin notes: {invoice.admin_notes}</p> : null}
              </div>
              <div className="row-actions">
                <button className="secondary-button compact" onClick={() => editInvoice(invoice)} type="button">Edit</button>
                <button className="danger-button compact" disabled={busy} onClick={() => deleteInvoice(invoice.id)} type="button">Delete</button>
              </div>
            </article>
          ))
        )}

        {pagination.has_more ? (
          <button className="secondary-button" disabled={busy} onClick={() => loadInvoices(token, pagination.page + 1, true)} type="button">Load more invoices</button>
        ) : null}
      </section>
        </>
      )}
    </main>
  );
}
