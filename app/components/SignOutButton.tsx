"use client";

import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function SignOutButton() {
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button className="secondary-button compact" onClick={signOut} type="button">
      Sign out
    </button>
  );
}
