"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { roles, type Profile, type Province, type School } from "@/lib/types";

type ApprovalPayload = {
  profiles: Profile[];
  provinces: Province[];
  schools: School[];
  admin_role?: string;
};

export default function ApprovalsClient() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<ApprovalPayload>({ profiles: [], provinces: [], schools: [] });
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function loadApprovals(activeToken: string) {
    const response = await fetch("/api/admin/approvals", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load approvals.");
      return;
    }

    setData(payload);
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const activeToken = sessionData.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/approvals";
        return;
      }

      setToken(activeToken);
      await loadApprovals(activeToken);
    }

    loadSession();
  }, []);

  async function updateProfile(
    profileId: string,
    action: "approve" | "reject",
    formData: FormData,
  ) {
    setBusyId(profileId);
    setError("");

    const response = await fetch(`/api/admin/approvals/${profileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        role: formData.get("role"),
        province_id: formData.get("province_id") || null,
        school_id: formData.get("school_id") || null,
        rejection_reason: formData.get("rejection_reason") || null,
      }),
    });

    const payload = await response.json();
    setBusyId("");

    if (!response.ok) {
      setError(payload.error ?? "Unable to update profile.");
      return;
    }

    await loadApprovals(token);
  }

  const assignableRoles = data.admin_role === "super_admin"
    ? roles
    : roles.filter((role) => role !== "super_admin" && role !== "national_admin");

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>Pending approvals</h1>
          <p className="muted">Approve, reject, and scope new users before they enter the portal.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">
            Dashboard
          </Link>
          <SignOutButton />
        </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="table-list">
        {data.profiles.length === 0 ? (
          <article className="empty-state">No pending profiles right now.</article>
        ) : (
          data.profiles.map((profile) => (
            <form
              className="approval-row"
              key={profile.id}
              onSubmit={(event) => {
                event.preventDefault();
                updateProfile(profile.id, "approve", new FormData(event.currentTarget));
              }}
            >
              <div>
                <h2>{profile.full_name}</h2>
                <p>{profile.email}</p>
                <p className="muted">Requested: {profile.requested_role.replaceAll("_", " ")}</p>
              </div>
              <label>
                Role
                <select name="role" defaultValue={profile.requested_role}>
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Province
                <select name="province_id" defaultValue="">
                  <option value="">None</option>
                  {data.provinces.map((province) => (
                    <option key={province.id} value={province.id}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                School
                <select name="school_id" defaultValue="">
                  <option value="">None</option>
                  {data.schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </label>
              <input name="rejection_reason" placeholder="Rejection note" />
              <div className="row-actions">
                <button className="primary-button compact" disabled={busyId === profile.id} type="submit">
                  Approve
                </button>
                <button
                  className="danger-button compact"
                  disabled={busyId === profile.id}
                  type="button"
                  onClick={(event) => {
                    const form = event.currentTarget.form;
                    if (form) updateProfile(profile.id, "reject", new FormData(form));
                  }}
                >
                  Reject
                </button>
              </div>
            </form>
          ))
        )}
      </section>
    </main>
  );
}
