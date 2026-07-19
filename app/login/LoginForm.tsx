"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import PasswordField from "@/app/components/PasswordField";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const nextPath = searchParams.get("next") || "/dashboard";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setBusy(false);
      setError(signInError.message);
      return;
    }

    window.location.href = nextPath;
  }

  async function sendResetEmail() {
    setBusy(true);
    setError("");
    setMessage("");

    if (!email) {
      setBusy(false);
      setError("Enter your email address first, then request a password reset.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to send password reset email.");
      return;
    }

    setMessage("Password reset email sent. Check your inbox.");
  }

  return (
    <form className="stack-form" onSubmit={onSubmit}>
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
      <PasswordField
        autoComplete="current-password"
        label="Password"
        onChange={setPassword}
        value={password}
      />
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
      <button className="primary-button" disabled={busy} type="submit">
        {busy ? "Signing in..." : "Sign in"}
      </button>
      <button className="secondary-button" disabled={busy} onClick={sendResetEmail} type="button">
        Forgot password
      </button>
    </form>
  );
}
