import { hasAdminAccess } from "@/lib/server/auth";
import { canAccessSchool, requireApprovedUser } from "@/lib/server/access";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type StudentRouteContext = {
  params: Promise<{ id: string }>;
};

function cleanStudentBody(body: Record<string, unknown> | null) {
  return {
    school_id: String(body?.school_id ?? "").trim(),
    first_name: String(body?.first_name ?? "").trim(),
    last_name: String(body?.last_name ?? "").trim(),
    date_of_birth: String(body?.date_of_birth ?? "").trim() || null,
    gender: String(body?.gender ?? "").trim(),
    race: String(body?.race ?? "").trim() || null,
    belt_rank: String(body?.belt_rank ?? "").trim() || null,
    membership_status: String(body?.membership_status ?? "active").trim() || "active",
  };
}

export async function PATCH(request: Request, context: StudentRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) {
    return response;
  }

  if (hasAdminAccess(user.profile.role) || user.profile.role === "provincial_admin" || user.profile.role === "instructor") {
    return Response.json({ error: "Admins can view student records but schools manage them." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const student = cleanStudentBody(body);

  if (!student.school_id || !student.first_name || !student.last_name || !student.gender) {
    return Response.json({ error: "School, first name, last name, and gender are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  if (!(await canAccessSchool(supabase, user, student.school_id))) {
    return Response.json({ error: "You cannot update students in that school." }, { status: 403 });
  }

  const { data: existing } = await supabase.from("students").select("school_id").eq("id", id).single();

  if (!existing || !(await canAccessSchool(supabase, user, existing.school_id))) {
    return Response.json({ error: "Student not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("students")
    .update(student)
    .eq("id", id)
    .select("id,school_id,instructor_id,first_name,last_name,date_of_birth,gender,race,belt_rank,membership_status,schools(name)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "student.updated",
    entityTable: "students",
    entityId: id,
    summary: `Updated student ${data.first_name} ${data.last_name}`,
    metadata: { school_id: data.school_id },
  });

  return Response.json({ student: data });
}

export async function DELETE(request: Request, context: StudentRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) {
    return response;
  }

  if (hasAdminAccess(user.profile.role) || user.profile.role === "provincial_admin" || user.profile.role === "instructor") {
    return Response.json({ error: "Admins can view student records but schools manage them." }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("students").select("school_id").eq("id", id).single();

  if (!existing || !(await canAccessSchool(supabase, user, existing.school_id))) {
    return Response.json({ error: "Student not found." }, { status: 404 });
  }

  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "student.deleted",
    entityTable: "students",
    entityId: id,
    summary: "Deleted student",
  });

  return Response.json({ ok: true });
}
