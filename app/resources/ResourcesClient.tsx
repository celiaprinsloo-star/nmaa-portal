"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { PortalDocument } from "@/lib/types";

export default function ResourcesClient() {
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadResources() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        window.location.href = "/login?next=/resources";
        return;
      }

      const response = await fetch("/api/portal-documents", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to load resources.");
        return;
      }

      setDocuments(payload.documents);
      setError("");
    }

    loadResources();
  }, []);

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Resources</p>
          <h1>NMAA South Africa documents</h1>
          <p className="muted">View shared reference documents for schools and instructors.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/school">School sections</Link>
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}

      <section className="content-shell table-list">
        {documents.length === 0 ? (
          <article className="empty-state">No shared documents have been added yet.</article>
        ) : (
          documents.map((document) => (
            <article className="list-row" key={document.id}>
              <div>
                <h2>{document.title}</h2>
                <p>{document.description ?? document.file_name}</p>
              </div>
              {document.signed_url ? <a className="primary-button compact" href={document.signed_url} target="_blank">View document</a> : null}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
