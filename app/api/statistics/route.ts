import { hasAdminAccess } from "@/lib/server/auth";
import { requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type StudentRow = {
  id: string;
  school_id: string;
  date_of_birth: string | null;
  gender: string | null;
  race: string | null;
  membership_status: string;
};

type Stats = {
  school_count: number;
  student_count: number;
  active_students: number;
  inactive_students: number;
  male_students: number;
  female_students: number;
  other_gender_students: number;
  little_dragons: number;
  karate_kids: number;
  teens_adults: number;
  age_not_recorded: number;
  race_counts: Record<string, number>;
};

function emptyStats(): Stats {
  return {
    school_count: 0,
    student_count: 0,
    active_students: 0,
    inactive_students: 0,
    male_students: 0,
    female_students: 0,
    other_gender_students: 0,
    little_dragons: 0,
    karate_kids: 0,
    teens_adults: 0,
    age_not_recorded: 0,
    race_counts: {},
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

function buildStats(students: StudentRow[], schoolCount: number) {
  const stats = emptyStats();
  stats.school_count = schoolCount;
  stats.student_count = students.length;

  for (const student of students) {
    if (student.membership_status === "active") stats.active_students += 1;
    else stats.inactive_students += 1;

    if (student.gender === "male") stats.male_students += 1;
    else if (student.gender === "female") stats.female_students += 1;
    else stats.other_gender_students += 1;

    const race = student.race || "Not recorded";
    stats.race_counts[race] = (stats.race_counts[race] ?? 0) + 1;

    const age = studentAge(student.date_of_birth);
    if (age === null || age < 4) stats.age_not_recorded += 1;
    else if (age >= 4 && age <= 6) stats.little_dragons += 1;
    else if (age >= 7 && age <= 12) stats.karate_kids += 1;
    else if (age >= 13) stats.teens_adults += 1;
  }

  return stats;
}

function relatedProvinceName(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string | null } | undefined;
    return first?.name ?? null;
  }

  if (value && typeof value === "object" && "name" in value) {
    return (value as { name?: string | null }).name ?? null;
  }

  return null;
}

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (!hasAdminAccess(user.profile.role) && user.profile.role !== "hq_viewer") {
    return Response.json({ error: "Statistics access required." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const [schoolsResult, provincesResult, studentsResult] = await Promise.all([
    supabase
      .from("schools")
      .select("id,province_id,name,city,affiliation_status,provinces(name,code)")
      .order("name"),
    supabase.from("provinces").select("id,name,code").order("name"),
    supabase
      .from("students")
      .select("id,school_id,date_of_birth,gender,race,membership_status"),
  ]);

  if (schoolsResult.error) return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  if (provincesResult.error) return Response.json({ error: provincesResult.error.message }, { status: 400 });
  if (studentsResult.error) return Response.json({ error: studentsResult.error.message }, { status: 400 });

  const schools = schoolsResult.data;
  const students = studentsResult.data;
  const national = buildStats(students, schools.length);

  const provinces = provincesResult.data.map((province) => {
    const provinceSchools = schools.filter((school) => school.province_id === province.id);
    const schoolIds = new Set(provinceSchools.map((school) => school.id));
    const provinceStudents = students.filter((student) => schoolIds.has(student.school_id));

    return {
      id: province.id,
      name: province.name,
      code: province.code,
      ...buildStats(provinceStudents, provinceSchools.length),
    };
  });

  const schoolStatistics = schools.map((school) => {
    const schoolStudents = students.filter((student) => student.school_id === school.id);

    return {
      id: school.id,
      name: school.name,
      city: school.city,
      province_id: school.province_id,
      province_name: relatedProvinceName(school.provinces),
      affiliation_status: school.affiliation_status,
      ...buildStats(schoolStudents, 1),
    };
  });

  return Response.json({
    national,
    provinces,
    schools: schoolStatistics,
  });
}
