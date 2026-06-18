"use client";

import { FormEvent, useState } from "react";
import { publicRegistrationRoles, type UserRole } from "@/lib/types";

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super admin",
  national_admin: "National admin",
  provincial_admin: "Provincial admin",
  school_owner: "School owner",
  instructor: "Instructor",
};

export default function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<UserRole>("school_owner");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        requested_role: requestedRole,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setBusy(false);
      setError(payload.error ?? "Registration failed.");
      return;
    }

    setBusy(false);
    setMessage("Registration received. You can sign in after approval.");
    window.location.href = "/pending-approval";
  }

  return (
    <form className="stack-form" onSubmit={onSubmit}>
      <label>
        Full name
        <input
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="name"
        />
      </label>
      <label>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label>
        Requested role
        <select
          value={requestedRole}
          onChange={(event) => setRequestedRole(event.target.value as UserRole)}
        >
          {publicRegistrationRoles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
      <button className="primary-button" disabled={busy} type="submit">
        {busy ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
