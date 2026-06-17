"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Province } from "@/lib/types";

export default function ProvincesClient() {
  const [token, setToken] = useState("");
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadProvinces(activeToken: string) {
    const response = await fetch("/api/admin/provinces", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load provinces.");
      return;
    }

    setProvinces(payload.provinces);
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/provinces";
        return;
      }

      setToken(activeToken);
      await loadProvinces(activeToken);
    }

    loadSession();
  }, []);

  function resetForm() {
    setEditingId("");
    setName("");
    setCode("");
  }

  function editProvince(province: Province) {
    setEditingId(province.id);
    setName(province.name);
    setCode(province.code);
  }

  async function saveProvince(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(
      editingId ? `/api/admin/provinces/${editingId}` : "/api/admin/provinces",
      {
        method: editingId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, code }),
      },
    );
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save province.");
      return;
    }

    resetForm();
    await loadProvinces(token);
  }

  async function deleteProvince(provinceId: string) {
    setBusy(true);
    setError("");

    const response = await fetch(`/api/admin/provinces/${provinceId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete province.");
      return;
    }

    await loadProvinces(token);
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>Provinces</h1>
          <p className="muted">Manage the national province structure used for school and user scoping.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      <section className="admin-workspace">
        <form className="admin-form" onSubmit={saveProvince}>
          <h2>{editingId ? "Edit province" : "Add province"}</h2>
          <label>
            Province name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Code
            <input value={code} onChange={(event) => setCode(event.target.value)} required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="row-actions">
            <button className="primary-button compact" disabled={busy} type="submit">
              {editingId ? "Save changes" : "Add province"}
            </button>
            {editingId ? (
              <button className="secondary-button compact" onClick={resetForm} type="button">
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="table-list">
          {provinces.map((province) => (
            <article className="list-row" key={province.id}>
              <div>
                <h2>{province.name}</h2>
                <p>{province.code} | {province.school_count ?? 0} schools | {province.student_count ?? 0} students | {province.active_student_count ?? 0} active</p>
              </div>
              <div className="row-actions">
                <button className="secondary-button compact" onClick={() => editProvince(province)} type="button">
                  Edit
                </button>
                <button className="danger-button compact" disabled={busy} onClick={() => deleteProvince(province.id)} type="button">
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
