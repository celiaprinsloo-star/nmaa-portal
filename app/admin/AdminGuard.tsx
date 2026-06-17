"use client";

import { ReactNode, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

type AdminGuardProps = {
  children: ReactNode;
};

export default function AdminGuard({ children }: AdminGuardProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkAccess() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        window.location.href = "/login?next=/admin/approvals";
        return;
      }

      const response = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        window.location.href = "/login?next=/admin/approvals";
        return;
      }

      const payload = await response.json();
      const activeProfile = payload.profile as Profile;

      if (activeProfile.approval_status !== "approved" || !activeProfile.role) {
        window.location.href = "/pending-approval";
        return;
      }

      if (activeProfile.role !== "super_admin" && activeProfile.role !== "national_admin") {
        setError("This area is limited to national administrators.");
        setLoading(false);
        return;
      }

      setProfile(activeProfile);
      setLoading(false);
    }

    checkAccess();
  }, []);

  if (loading) {
    return <main className="app-page">Checking admin access...</main>;
  }

  if (error || !profile) {
    return (
      <main className="app-page">
        <section className="empty-state">{error || "Admin access required."}</section>
      </main>
    );
  }

  return children;
}
