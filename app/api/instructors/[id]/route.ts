import { canAccessSchool, requireApprovedUser } from "@/lib/server/access";
import { hasAdminAccess } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type InstructorRouteContext = {
  params: Promise<{ id: string }>;
};

function cleanInstructorBody(body: Record<string, unknown> | null) {
  return {
    school_id: String(body?.school_id ?? "").trim(),
    full_name: String(body?.full_name ?? "").trim(),
    email: String(body?.email ?? "").trim() || null,
    phone: String(body?.phone ?? "").trim() || null,
    certification_level: String(body?.certification_level ?? "").trim() || null,
    rank: String(body?.rank ?? body?.certification_level ?? "").trim() || null,
    collar_level: String(body?.collar_level ?? "").trim() || null,
    certification_date: String(body?.certification_date ?? body?.training_expires_at ?? "").trim() || null,
    training_status: String(body?.training_status ?? "pending").trim() || "pending",
    training_expires_at: String(body?.training_expires_at ?? body?.certification_date ?? "").trim() || null,
    active: Boolean(body?.active ?? true),
  };
}

const instructorSelect =
  "id,profile_id,school_id,full_name,email,phone,certification_level,rank,collar_level,certification_date,training_status,training_expires_at,active,schools(name)";

export async function PATCH(request: Request, context: InstructorRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (!hasAdminAccess(user.profile.role) && user.profile.role !== "school_owner") {
    return Response.json({ error: "Only school owners and admins can manage instructors." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const instructor = cleanInstructorBody(body);
  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase.from("instructors").select("school_id").eq("id", id).single();

  if (!existing || !(await canAccessSchool(supabase, user, existing.school_id)) || !(await canAccessSchool(supabase, user, instructor.school_id))) {
    return Response.json({ error: "Instructor not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("instructors")
    .update(instructor)
    .eq("id", id)
    .select(instructorSelect)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ instructor: data });
}

export async function DELETE(request: Request, context: InstructorRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (!hasAdminAccess(user.profile.role) && user.profile.role !== "school_owner") {
    return Response.json({ error: "Only school owners and admins can manage instructors." }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("instructors").select("school_id").eq("id", id).single();

  if (!existing || !(await canAccessSchool(supabase, user, existing.school_id))) {
    return Response.json({ error: "Instructor not found." }, { status: 404 });
  }

  const { error } = await supabase.from("instructors").delete().eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
