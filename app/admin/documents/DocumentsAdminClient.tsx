"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { PortalDocument } from "@/lib/types";

export default function DocumentsAdminClient() {
  const [token, setToken] = useState("");
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [title, setTitle] = useState("NMAA South Africa Constitution");
  const [description, setDescription] = useState("Style constitution for NMAA South Africa schools.");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadDocuments(activeToken: string) {
    const response = await fetch("/api/portal-documents", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load portal documents.");
      return;
    }

    setDocuments(payload.documents);
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/documents";
        return;
      }

      setToken(activeToken);
      await loadDocuments(activeToken);
    }

    loadSession();
  }, []);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("category", "constitution");
    if (file) formData.append("file", file);

    const response = await fetch("/api/portal-documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to upload document.");
      return;
    }

    setFile(null);
    await loadDocuments(token);
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>Portal documents</h1>
          <p className="muted">Upload shared documents that school owners can view.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      <section className="admin-workspace">
        <form className="admin-form" onSubmit={uploadDocument}>
          <h2>Add constitution</h2>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Document file<input accept=".pdf,.doc,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" /></label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button compact" disabled={busy} type="submit">Upload document</button>
        </form>

        <section className="table-list">
          {documents.length === 0 ? (
            <article className="empty-state">No portal documents uploaded yet.</article>
          ) : (
            documents.map((document) => (
              <article className="list-row" key={document.id}>
                <div>
                  <h2>{document.title}</h2>
                  <dl className="detail-grid">
                    <div><dt>File</dt><dd>{document.file_name}</dd></div>
                    <div><dt>Category</dt><dd>{document.category}</dd></div>
                  </dl>
                </div>
                {document.signed_url ? <a className="secondary-button compact" href={document.signed_url} target="_blank">View</a> : null}
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
