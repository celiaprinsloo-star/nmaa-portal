import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { Profile, UserRole } from "@/lib/types";

export type AuthenticatedUser = {
  id: string;
  email: string;
  profile: Profile;
};

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function getAuthenticatedUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return { user: null, error: "Missing session token." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return { user: null, error: "Invalid or expired session." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, error: "Profile not found." };
  }

  const user: AuthenticatedUser = {
    id: authData.user.id,
    email: authData.user.email ?? profile.email,
    profile: profile as Profile,
  };

  return { user, error: null };
}

export function hasAdminAccess(role: UserRole | null) {
  return role === "super_admin" || role === "national_admin";
}
