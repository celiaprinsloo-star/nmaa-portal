import { canAccessSchool, getAllowedSchoolIds, requireApprovedUser } from "@/lib/server/access";
import { hasAdminAccess } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

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

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role === "instructor") {
    return Response.json({ error: "Instructor management is handled by school owners and admins." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const requestedSchoolId = new URL(request.url).searchParams.get("school_id");
  const { schoolIds, error: schoolError } = await getAllowedSchoolIds(supabase, user);

  if (schoolError) {
    return Response.json({ error: schoolError }, { status: 400 });
  }

  const instructorsQuery = supabase
    .from("instructors")
    .select(instructorSelect)
    .order("full_name");
  const schoolsQuery = supabase
    .from("schools")
    .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,affiliation_status")
    .order("name");

  const filteredSchoolIds = requestedSchoolId ? schoolIds.filter((schoolId) => schoolId === requestedSchoolId) : schoolIds;

  if (filteredSchoolIds.length > 0) {
    instructorsQuery.in("school_id", filteredSchoolIds);
    schoolsQuery.in("id", filteredSchoolIds);
  } else {
    instructorsQuery.eq("school_id", "00000000-0000-0000-0000-000000000000");
    schoolsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const [instructorsResult, schoolsResult] = await Promise.all([instructorsQuery, schoolsQuery]);

  if (instructorsResult.error) {
    return Response.json({ error: instructorsResult.error.message }, { status: 400 });
  }

  if (schoolsResult.error) {
    return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  }

  return Response.json({ instructors: instructorsResult.data, schools: schoolsResult.data });
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (!hasAdminAccess(user.profile.role) && user.profile.role !== "school_owner") {
    return Response.json({ error: "Only school owners and admins can manage instructors." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const instructor = cleanInstructorBody(body);

  if (!instructor.school_id || !instructor.full_name) {
    return Response.json({ error: "School and instructor name are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  if (!(await canAccessSchool(supabase, user, instructor.school_id))) {
    return Response.json({ error: "You cannot add instructors to that school." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("instructors")
    .insert(instructor)
    .select(instructorSelect)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ instructor: data });
}
