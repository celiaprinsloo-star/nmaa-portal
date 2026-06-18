"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type AuditLog = {
  id: string;
  action: string;
  entity_table: string;
  entity_id: string | null;
  summary: string | null;
  created_at: string;
};

export default function AuditLogsClient() {
  const [token, setToken] = useState("");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 50, total: 0, has_more: false });
  const [error, setError] = useState("");

  async function loadLogs(activeToken: string, page = 1, append = false) {
    const response = await fetch(`/api/admin/audit-logs?page=${page}&page_size=50`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load audit logs.");
      return;
    }

    setLogs((current) => (append ? [...current, ...payload.logs] : payload.logs));
    setPagination(payload.pagination);
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/audit-logs";
        return;
      }

      setToken(activeToken);
      await loadLogs(activeToken);
    }

    loadSession();
  }, []);

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>Audit logs</h1>
          <p className="muted">Review important portal changes and admin actions.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}

      <section className="content-shell table-list">
        {logs.length === 0 ? (
          <article className="empty-state">No audit logs recorded yet.</article>
        ) : (
          logs.map((log) => (
            <article className="list-row" key={log.id}>
              <div>
                <h2>{log.summary ?? log.action}</h2>
                <dl className="detail-grid">
                  <div><dt>Action</dt><dd>{log.action}</dd></div>
                  <div><dt>Table</dt><dd>{log.entity_table}</dd></div>
                  <div><dt>Record</dt><dd>{log.entity_id ?? "No record id"}</dd></div>
                  <div><dt>Date</dt><dd>{new Date(log.created_at).toLocaleString()}</dd></div>
                </dl>
              </div>
            </article>
          ))
        )}
        {pagination.has_more ? (
          <button className="secondary-button" onClick={() => loadLogs(token, pagination.page + 1, true)} type="button">Load more logs</button>
        ) : null}
      </section>
    </main>
  );
}
