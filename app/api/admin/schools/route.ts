import { requireAdmin } from "@/lib/server/requireAdmin";
import { logAuditEvent } from "@/lib/server/audit";
import { paginationFromUrl, paginationPayload } from "@/lib/server/pagination";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function cleanSchoolBody(body: Record<string, unknown> | null) {
  return {
    province_id: String(body?.province_id ?? "").trim(),
    name: String(body?.name ?? "").trim(),
    registration_number: String(body?.registration_number ?? "").trim() || null,
    city: String(body?.city ?? "").trim() || null,
    address: String(body?.address ?? "").trim() || null,
    contact_email: String(body?.contact_email ?? "").trim() || null,
    contact_phone: String(body?.contact_phone ?? "").trim() || null,
    logo_url: String(body?.logo_url ?? "").trim() || null,
    affiliation_status: String(body?.affiliation_status ?? "pending").trim() || "pending",
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

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  const provinceId = url.searchParams.get("province_id")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const { page, pageSize } = paginationFromUrl(request.url);
  const [schoolsResult, provincesResult, studentsResult, requirementsResult, documentsResult, instructorsResult] = await Promise.all([
    supabase
      .from("schools")
      .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,logo_url,affiliation_status,provinces(name,code)")
      .order("name"),
    supabase.from("provinces").select("id,name,code").order("name"),
    supabase.from("students").select("id,school_id,date_of_birth,gender,race,membership_status"),
    supabase
      .from("compliance_requirements")
      .select("id,applies_to,active")
      .eq("active", true),
    supabase
      .from("compliance_documents")
      .select("id,school_id,instructor_id,requirement_id,status,expires_at"),
    supabase.from("instructors").select("id,school_id,active"),
  ]);

  if (schoolsResult.error) {
    return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  }

  if (provincesResult.error) {
    return Response.json({ error: provincesResult.error.message }, { status: 400 });
  }

  if (studentsResult.error) {
    return Response.json({ error: studentsResult.error.message }, { status: 400 });
  }

  if (requirementsResult.error) {
    return Response.json({ error: requirementsResult.error.message }, { status: 400 });
  }

  if (documentsResult.error) {
    return Response.json({ error: documentsResult.error.message }, { status: 400 });
  }

  if (instructorsResult.error) {
    return Response.json({ error: instructorsResult.error.message }, { status: 400 });
  }

  const today = new Date();
  const schools = schoolsResult.data.map((school) => {
    const students = studentsResult.data.filter((student) => student.school_id === school.id);
    const documents = documentsResult.data.filter((document) => document.school_id === school.id);
    const instructors = instructorsResult.data.filter((instructor) => instructor.school_id === school.id && instructor.active);
    const requiredComplianceKeys = requirementsResult.data.flatMap((requirement) => {
      if (requirement.applies_to === "instructor") {
        return instructors.map((instructor) => `${requirement.id}:${instructor.id}`);
      }

      if (requirement.applies_to === "school") {
        return [`${requirement.id}:school`];
      }

      return [];
    });
    const submittedRequirementIds = new Set(
      documents
        .filter((document) => {
          if (!document.requirement_id) return false;
          if (document.status === "rejected" || document.status === "expired") return false;
          if (!document.expires_at) return true;
          return new Date(document.expires_at) >= today;
        })
        .map((document) => `${document.requirement_id}:${document.instructor_id ?? "school"}`),
    );
    const raceCounts = students.reduce<Record<string, number>>((counts, student) => {
      const race = student.race || "Not recorded";
      counts[race] = (counts[race] ?? 0) + 1;
      return counts;
    }, {});
    const ageCounts = students.reduce(
      (counts, student) => {
        const age = studentAge(student.date_of_birth);
        if (age === null || age < 4) {
          counts.notInAgeGroups += 1;
          return counts;
        }

        if (age >= 4 && age <= 6) counts.littleDragons += 1;
        else if (age >= 7 && age <= 12) counts.karateKids += 1;
        else if (age >= 13) counts.teensAdults += 1;
        return counts;
      },
      { littleDragons: 0, karateKids: 0, teensAdults: 0, notInAgeGroups: 0 },
    );

    return {
      ...school,
      student_count: students.length,
      male_student_count: students.filter((student) => student.gender === "male").length,
      female_student_count: students.filter((student) => student.gender === "female").length,
      little_dragons_count: ageCounts.littleDragons,
      karate_kids_count: ageCounts.karateKids,
      teens_adults_count: ageCounts.teensAdults,
      age_not_grouped_count: ageCounts.notInAgeGroups,
      race_counts: raceCounts,
      instructor_count: instructors.length,
      submitted_compliance_count: documents.length,
      outstanding_compliance_count: requiredComplianceKeys.filter((key) => !submittedRequirementIds.has(key)).length,
      expired_compliance_count: documents.filter((document) => {
        if (document.status === "expired") return true;
        if (!document.expires_at) return false;
        return new Date(document.expires_at) < today;
      }).length,
    };
  }).filter((school) => {
    if (search && !`${school.name} ${school.city ?? ""} ${school.contact_email ?? ""}`.toLowerCase().includes(search)) return false;
    if (provinceId && school.province_id !== provinceId) return false;
    if (status && school.affiliation_status !== status) return false;
    return true;
  });

  const from = (page - 1) * pageSize;
  const pagedSchools = schools.slice(from, from + pageSize);

  return Response.json({
    schools: pagedSchools,
    provinces: provincesResult.data,
    pagination: paginationPayload(page, pageSize, schools.length),
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const school = cleanSchoolBody(body);

  if (!school.province_id || !school.name) {
    return Response.json({ error: "School name and province are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("schools")
    .insert(school)
    .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,logo_url,affiliation_status,provinces(name,code)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "school.created",
    entityTable: "schools",
    entityId: data.id,
    summary: `Created school ${data.name}`,
  });

  return Response.json({ school: data });
}
