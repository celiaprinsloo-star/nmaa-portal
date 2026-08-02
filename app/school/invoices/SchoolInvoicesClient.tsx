"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { SchoolInvoice } from "@/lib/types";

function money(value: number | string | null) {
  return `R${Number(value ?? 0).toFixed(2)}`;
}

function dateLabel(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-ZA", { dateStyle: "medium" });
}

export default function SchoolInvoicesClient() {
  const [invoices, setInvoices] = useState<SchoolInvoice[]>([]);
  const [error, setError] = useState("");

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

  useEffect(() => {
    async function loadInvoices() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/school/invoices";
        return;
      }

      const response = await fetch("/api/invoices", {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to load invoices.");
        return;
      }

      setInvoices(payload.invoices ?? []);
      setError("");
    }

    loadInvoices();
  }, []);

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">School workspace</p>
          <h1>Invoices</h1>
          <p className="muted">View outstanding and paid invoices for your school.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}

      <section className="stat-grid">
        <article><strong>{money(totals.outstanding)}</strong><span>Outstanding</span></article>
        <article><strong>{money(totals.paid)}</strong><span>Paid</span></article>
        <article><strong>{invoices.length}</strong><span>Total invoices</span></article>
      </section>

      <section className="content-shell table-list">
        {invoices.length === 0 ? (
          <article className="empty-state">No invoices have been added for your school yet.</article>
        ) : (
          invoices.map((invoice) => (
            <article className="list-row" key={invoice.id}>
              <div>
                <h2>{invoice.invoice_number} - {invoice.title}</h2>
                <dl className="detail-grid">
                  <div><dt>Amount</dt><dd>{money(invoice.amount_zar)}</dd></div>
                  <div><dt>Due date</dt><dd>{dateLabel(invoice.due_date)}</dd></div>
                  <div><dt>Status</dt><dd><span className={`status-pill status-${invoice.status}`}>{invoice.status}</span></dd></div>
                </dl>
                {invoice.description ? <p className="muted">{invoice.description}</p> : null}
                {invoice.admin_notes ? <p className="small-note">Note: {invoice.admin_notes}</p> : null}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
