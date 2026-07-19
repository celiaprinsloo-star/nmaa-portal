"use client";

import { FormEvent, useEffect, useState } from "react";
import PasswordField from "@/app/components/PasswordField";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadResetSession() {
      const supabase = createSupabaseBrowserClient();

      if (window.location.hash.includes("access_token")) {
        const { error: sessionError } = await supabase.auth.getSession();
        if (sessionError) setError(sessionError.message);
      }
    }

    loadResetSession();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    if (password.length < 8) {
      setBusy(false);
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setBusy(false);
      setError("Passwords do not match.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Password updated. You can now sign in.");
  }

  return (
    <form className="stack-form" onSubmit={onSubmit}>
      <PasswordField
        autoComplete="new-password"
        label="New password"
        minLength={8}
        onChange={setPassword}
        value={password}
      />
      <PasswordField
        autoComplete="new-password"
        label="Confirm password"
        minLength={8}
        onChange={setConfirmPassword}
        value={confirmPassword}
      />
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
      <button className="primary-button" disabled={busy} type="submit">
        {busy ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
