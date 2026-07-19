import { getAllowedSchoolIds, requireApprovedUser } from "@/lib/server/access";
import { logAuditEvent } from "@/lib/server/audit";
import { paginationFromUrl, paginationPayload } from "@/lib/server/pagination";
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

function studentAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) age -= 1;
  return age;
}

function matchesAgeGroup(dateOfBirth: string | null, ageGroup: string) {
  const age = studentAge(dateOfBirth);

  if (ageGroup === "little_dragons") return age !== null && age >= 4 && age <= 6;
  if (ageGroup === "karate_kids") return age !== null && age >= 7 && age <= 12;
  if (ageGroup === "teens_adults") return age !== null && age >= 13;
  if (ageGroup === "not_grouped") return age === null || age < 4;

  return true;
}

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) {
    return response;
  }

  if (user.profile.role === "instructor") {
    return Response.json({ error: "Instructors use the tournament results page for student results." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const url = new URL(request.url);
  const requestedSchoolId = url.searchParams.get("school_id");
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const gender = url.searchParams.get("gender")?.trim();
  const race = url.searchParams.get("race")?.trim();
  const rank = url.searchParams.get("rank")?.trim();
  const ageGroup = url.searchParams.get("age_group")?.trim();
  const { page, pageSize, from, to } = paginationFromUrl(request.url);
  const { schoolIds, error: schoolError } = user.profile.role === "hq_viewer"
    ? await supabase
        .from("schools")
        .select("id")
        .order("name")
        .then(({ data, error }) => ({
          schoolIds: data?.map((school) => school.id) ?? [],
          error: error?.message ?? null,
        }))
    : await getAllowedSchoolIds(supabase, user);

  if (schoolError) {
    return Response.json({ error: schoolError }, { status: 400 });
  }

  const schoolsQuery = supabase
    .from("schools")
    .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,affiliation_status")
    .order("name");

  const studentsQuery = supabase
    .from("students")
    .select("id,school_id,instructor_id,first_name,last_name,date_of_birth,gender,race,belt_rank,membership_status,schools(name)", { count: "exact" })
    .order("last_name");

  const filteredSchoolIds = requestedSchoolId ? schoolIds.filter((schoolId) => schoolId === requestedSchoolId) : schoolIds;

  if (filteredSchoolIds.length > 0) {
    schoolsQuery.in("id", filteredSchoolIds);
    studentsQuery.in("school_id", filteredSchoolIds);
  } else {
    schoolsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    studentsQuery.eq("school_id", "00000000-0000-0000-0000-000000000000");
  }

  if (search) studentsQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  if (status) studentsQuery.eq("membership_status", status);
  if (gender) studentsQuery.eq("gender", gender);
  if (race) studentsQuery.eq("race", race);
  if (rank) studentsQuery.eq("belt_rank", rank);

  if (!ageGroup) studentsQuery.range(from, to);

  const [studentsResult, schoolsResult] = await Promise.all([studentsQuery, schoolsQuery]);

  if (studentsResult.error) {
    return Response.json({ error: studentsResult.error.message }, { status: 400 });
  }

  if (schoolsResult.error) {
    return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  }

  const filteredStudents = ageGroup
    ? studentsResult.data.filter((student) => matchesAgeGroup(student.date_of_birth, ageGroup))
    : studentsResult.data;
  const pagedStudents = ageGroup ? filteredStudents.slice(from, to + 1) : filteredStudents;

  return Response.json({
    students: pagedStudents,
    schools: schoolsResult.data,
    pagination: paginationPayload(page, pageSize, ageGroup ? filteredStudents.length : studentsResult.count),
    profile_role: user.profile.role,
    can_manage_students: user.profile.role === "school_owner",
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) {
    return response;
  }

  if (user.profile.role !== "school_owner") {
    return Response.json({ error: "This role can view student records, but only school owners can manage them." }, { status: 403 });
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

  await logAuditEvent({
    actorId: user.id,
    action: "student.created",
    entityTable: "students",
    entityId: data.id,
    summary: `Created student ${data.first_name} ${data.last_name}`,
    metadata: { school_id: data.school_id },
  });

  return Response.json({ student: data });
}
