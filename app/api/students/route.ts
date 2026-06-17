import { hasAdminAccess } from "@/lib/server/auth";
import { getAllowedSchoolIds, requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

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

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) {
    return response;
  }

  if (user.profile.role === "instructor") {
    return Response.json({ error: "Instructors use the placements page for student results." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const requestedSchoolId = new URL(request.url).searchParams.get("school_id");
  const { schoolIds, error: schoolError } = await getAllowedSchoolIds(supabase, user);

  if (schoolError) {
    return Response.json({ error: schoolError }, { status: 400 });
  }

  const schoolsQuery = supabase
    .from("schools")
    .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,affiliation_status")
    .order("name");

  const studentsQuery = supabase
    .from("students")
    .select("id,school_id,instructor_id,first_name,last_name,date_of_birth,gender,race,belt_rank,membership_status,schools(name)")
    .order("last_name");

  const filteredSchoolIds = requestedSchoolId ? schoolIds.filter((schoolId) => schoolId === requestedSchoolId) : schoolIds;

  if (filteredSchoolIds.length > 0) {
    schoolsQuery.in("id", filteredSchoolIds);
    studentsQuery.in("school_id", filteredSchoolIds);
  } else {
    schoolsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    studentsQuery.eq("school_id", "00000000-0000-0000-0000-000000000000");
  }

  const [studentsResult, schoolsResult] = await Promise.all([studentsQuery, schoolsQuery]);

  if (studentsResult.error) {
    return Response.json({ error: studentsResult.error.message }, { status: 400 });
  }

  if (schoolsResult.error) {
    return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  }

  return Response.json({
    students: studentsResult.data,
    schools: schoolsResult.data,
    profile_role: user.profile.role,
    can_manage_students: user.profile.role === "school_owner",
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) {
    return response;
  }

  if (hasAdminAccess(user.profile.role) || user.profile.role === "provincial_admin" || user.profile.role === "instructor") {
    return Response.json({ error: "Admins can view student records but schools manage them." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const student = cleanStudentBody(body);

  if (!student.school_id || !student.first_name || !student.last_name || !student.gender) {
    return Response.json({ error: "School, first name, last name, and gender are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { schoolIds, error: schoolError } = await getAllowedSchoolIds(supabase, user);

  if (schoolError) {
    return Response.json({ error: schoolError }, { status: 400 });
  }

  if (!schoolIds.includes(student.school_id)) {
    return Response.json({ error: "You cannot add students to that school." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("students")
    .insert(student)
    .select("id,school_id,instructor_id,first_name,last_name,date_of_birth,gender,race,belt_rank,membership_status,schools(name)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ student: data });
}
