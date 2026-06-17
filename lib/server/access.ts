import "server-only";

import { getAuthenticatedUser, hasAdminAccess } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function requireApprovedUser(request: Request) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return { user: null, response: Response.json({ error }, { status: 401 }) };
  }

  if (user.profile.approval_status !== "approved" || !user.profile.role) {
    return {
      user: null,
      response: Response.json({ error: "Approved portal access required." }, { status: 403 }),
    };
  }

  return { user, response: null };
}

export async function getAllowedSchoolIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>,
) {
  if (hasAdminAccess(user.profile.role)) {
    const { data, error } = await supabase.from("schools").select("id").order("name");
    if (error) return { schoolIds: [] as string[], error: error.message };
    return { schoolIds: data.map((school) => school.id), error: null };
  }

  if (user.profile.role === "provincial_admin" && user.profile.province_id) {
    const { data, error } = await supabase
      .from("schools")
      .select("id")
      .eq("province_id", user.profile.province_id)
      .order("name");
    if (error) return { schoolIds: [] as string[], error: error.message };
    return { schoolIds: data.map((school) => school.id), error: null };
  }

  if ((user.profile.role === "school_owner" || user.profile.role === "instructor") && user.profile.school_id) {
    return { schoolIds: [user.profile.school_id], error: null };
  }

  return { schoolIds: [] as string[], error: null };
}

export async function canAccessSchool(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>,
  schoolId: string,
) {
  if (hasAdminAccess(user.profile.role)) {
    return true;
  }

  if ((user.profile.role === "school_owner" || user.profile.role === "instructor") && user.profile.school_id === schoolId) {
    return true;
  }

  if (user.profile.role === "provincial_admin" && user.profile.province_id) {
    const { data } = await supabase
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .eq("province_id", user.profile.province_id)
      .maybeSingle();
    return Boolean(data);
  }

  return false;
}
