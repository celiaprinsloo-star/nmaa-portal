import { requireAdmin } from "@/lib/server/requireAdmin";
import { paginationFromUrl, paginationPayload } from "@/lib/server/pagination";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function cleanRequirementBody(body: Record<string, unknown> | null) {
  return {
    name: String(body?.name ?? "").trim(),
    description: String(body?.description ?? "").trim() || null,
    category: String(body?.category ?? "general").trim() || "general",
    applies_to: String(body?.applies_to ?? "instructor").trim() || "instructor",
    renewal_period_months: body?.renewal_period_months
      ? Number(body.renewal_period_months)
      : null,
    active: Boolean(body?.active ?? true),
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("school_id");
  const status = url.searchParams.get("status")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const expiry = url.searchParams.get("expiry")?.trim();
  const search = url.searchParams.get("search")?.trim();
  const { page, pageSize, from, to } = paginationFromUrl(request.url);
  const requirementsQuery = supabase
    .from("compliance_requirements")
    .select("id,name,description,category,applies_to,renewal_period_months,active")
    .order("category")
    .order("name");
  const documentsQuery = supabase
    .from("compliance_documents")
    .select("id,school_id,instructor_id,student_id,requirement_id,document_name,storage_path,file_name,file_type,file_size,status,expires_at,compliance_requirements(name,category),schools(name),instructors(full_name),students(first_name,last_name)", { count: "exact" })
    .order("expires_at");
  const schoolsQuery = supabase.from("schools").select("id,name").order("name");

  if (schoolId) {
    documentsQuery.eq("school_id", schoolId);
    schoolsQuery.eq("id", schoolId);
  }

  if (status) documentsQuery.eq("status", status);
  if (search) documentsQuery.ilike("document_name", `%${search}%`);
  if (expiry === "expired") documentsQuery.lt("expires_at", new Date().toISOString().slice(0, 10));
  if (expiry === "next_30") {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setDate(today.getDate() + 30);
    documentsQuery.gte("expires_at", today.toISOString().slice(0, 10)).lte("expires_at", nextMonth.toISOString().slice(0, 10));
  }
  if (category) {
    const { data: matchingRequirements } = await supabase.from("compliance_requirements").select("id").eq("category", category);
    documentsQuery.in("requirement_id", (matchingRequirements ?? []).map((requirement) => requirement.id));
  }

  documentsQuery.range(from, to);

  const [requirementsResult, documentsResult, schoolsResult] = await Promise.all([
    requirementsQuery,
    documentsQuery,
    schoolsQuery,
  ]);

  if (requirementsResult.error) {
    return Response.json({ error: requirementsResult.error.message }, { status: 400 });
  }

  if (documentsResult.error) {
    return Response.json({ error: documentsResult.error.message }, { status: 400 });
  }

  if (schoolsResult.error) {
    return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  }

  return Response.json({
    requirements: requirementsResult.data,
    documents: documentsResult.data,
    schools: schoolsResult.data,
    pagination: paginationPayload(page, pageSize, documentsResult.count),
    selected_school_id: schoolId,
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const requirement = cleanRequirementBody(body);

  if (!requirement.name) {
    return Response.json({ error: "Requirement name is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("compliance_requirements")
    .insert(requirement)
    .select("id,name,description,category,applies_to,renewal_period_months,active")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ requirement: data });
}
