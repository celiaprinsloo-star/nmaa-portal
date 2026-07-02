"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

const defaultPortalOrigin = "https://portal.nmaa-sa.co.za";

function passwordResetOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, "");

  const currentOrigin = window.location.origin;
  if (currentOrigin.includes("localhost") || currentOrigin.includes("127.0.0.1")) {
    return defaultPortalOrigin;
  }

  return currentOrigin;
}

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

    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${passwordResetOrigin()}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setBusy(false);

    if (resetError) {
      setError(resetError.message);
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
      <label>
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
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
