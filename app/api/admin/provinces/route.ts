import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const [provincesResult, schoolsResult, studentsResult] = await Promise.all([
    supabase.from("provinces").select("id,name,code,created_at").order("name"),
    supabase.from("schools").select("id,province_id"),
    supabase.from("students").select("id,school_id,membership_status"),
  ]);

  if (provincesResult.error) {
    return Response.json({ error: provincesResult.error.message }, { status: 400 });
  }

  if (schoolsResult.error) {
    return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  }

  if (studentsResult.error) {
    return Response.json({ error: studentsResult.error.message }, { status: 400 });
  }

  const schools = schoolsResult.data;
  const students = studentsResult.data;

  const provinces = provincesResult.data.map((province) => {
    const provinceSchools = schools.filter((school) => school.province_id === province.id);
    const schoolIds = new Set(provinceSchools.map((school) => school.id));
    const provinceStudents = students.filter((student) => schoolIds.has(student.school_id));

    return {
      ...province,
      school_count: provinceSchools.length,
      student_count: provinceStudents.length,
      active_student_count: provinceStudents.filter((student) => student.membership_status === "active").length,
    };
  });

  return Response.json({ provinces });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim().toUpperCase();

  if (!name || !code) {
    return Response.json({ error: "Province name and code are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("provinces")
    .insert({ name, code })
    .select("id,name,code,created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ province: data });
}
