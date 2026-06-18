import { canAccessSchool, getAllowedSchoolIds, requireApprovedUser } from "@/lib/server/access";
import { hasAdminAccess } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const complianceBucket = "compliance-documents";
const maxComplianceFileSize = 10 * 1024 * 1024;
const allowedComplianceFileTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const documentSelect =
  "id,school_id,instructor_id,student_id,requirement_id,document_name,storage_path,file_name,file_type,file_size,status,expires_at,compliance_requirements(name,category)";

function cleanDocumentBody(body: Record<string, unknown> | null) {
  return {
    school_id: String(body?.school_id ?? "").trim() || null,
    instructor_id: String(body?.instructor_id ?? "").trim() || null,
    requirement_id: String(body?.requirement_id ?? "").trim() || null,
    document_name: String(body?.document_name ?? "").trim(),
    storage_path: String(body?.storage_path ?? "").trim() || null,
    status: String(body?.status ?? "submitted").trim() || "submitted",
    expires_at: String(body?.expires_at ?? "").trim() || null,
  };
}

function cleanDocumentForm(formData: FormData) {
  return {
    school_id: String(formData.get("school_id") ?? "").trim() || null,
    instructor_id: String(formData.get("instructor_id") ?? "").trim() || null,
    requirement_id: String(formData.get("requirement_id") ?? "").trim() || null,
    document_name: String(formData.get("document_name") ?? "").trim(),
    storage_path: String(formData.get("storage_path") ?? "").trim() || null,
    status: String(formData.get("status") ?? "submitted").trim() || "submitted",
    expires_at: String(formData.get("expires_at") ?? "").trim() || null,
  };
}

async function uploadComplianceFile(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  file: File | null,
  schoolId: string,
) {
  if (!file || file.size === 0) return {};

  if (!allowedComplianceFileTypes.has(file.type)) {
    return { error: "Upload a PDF, Word document, PNG, JPG, or WebP file." };
  }

  if (file.size > maxComplianceFileSize) {
    return { error: "Compliance files must be smaller than 10MB." };
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${schoolId}/${crypto.randomUUID()}-${cleanName}`;
  const { error } = await supabase.storage.from(complianceBucket).upload(storagePath, await file.arrayBuffer(), {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) return { error: error.message };

  return {
    storage_path: storagePath,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role === "instructor") {
    return Response.json({ error: "Compliance documents are managed by school owners and admins." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { schoolIds, error: schoolError } = await getAllowedSchoolIds(supabase, user);

  if (schoolError) return Response.json({ error: schoolError }, { status: 400 });

  const docsQuery = supabase
    .from("compliance_documents")
    .select(documentSelect)
    .order("expires_at");
  const requirementsQuery = supabase
    .from("compliance_requirements")
    .select("id,name,description,category,applies_to,renewal_period_months,active")
    .eq("active", true)
    .order("category")
    .order("name");
  const schoolsQuery = supabase
    .from("schools")
    .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,affiliation_status")
    .order("name");
  const instructorsQuery = supabase
    .from("instructors")
    .select("id,school_id,full_name")
    .order("full_name");

  if (schoolIds.length > 0) {
    docsQuery.in("school_id", schoolIds);
    schoolsQuery.in("id", schoolIds);
    instructorsQuery.in("school_id", schoolIds);
  } else {
    docsQuery.eq("school_id", "00000000-0000-0000-0000-000000000000");
    schoolsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    instructorsQuery.eq("school_id", "00000000-0000-0000-0000-000000000000");
  }

  const [documentsResult, requirementsResult, schoolsResult, instructorsResult] = await Promise.all([
    docsQuery,
    requirementsQuery,
    schoolsQuery,
    instructorsQuery,
  ]);

  if (documentsResult.error) return Response.json({ error: documentsResult.error.message }, { status: 400 });
  if (requirementsResult.error) return Response.json({ error: requirementsResult.error.message }, { status: 400 });
  if (schoolsResult.error) return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  if (instructorsResult.error) return Response.json({ error: instructorsResult.error.message }, { status: 400 });

  return Response.json({
    documents: documentsResult.data,
    requirements: requirementsResult.data,
    schools: schoolsResult.data,
    instructors: instructorsResult.data,
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role === "instructor") {
    return Response.json({ error: "Compliance documents are managed by school owners and admins." }, { status: 403 });
  }

  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
  const formData = isMultipart ? await request.formData().catch(() => null) : null;
  const body = isMultipart ? null : await request.json().catch(() => null);
  const document = formData ? cleanDocumentForm(formData) : cleanDocumentBody(body);
  const isAdmin = hasAdminAccess(user.profile.role);

  if (!isAdmin) {
    document.status = "submitted";
  }

  if (!document.school_id || !document.document_name) {
    return Response.json({ error: "School and document name are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  if (!(await canAccessSchool(supabase, user, document.school_id))) {
    return Response.json({ error: "You cannot add compliance documents for that school." }, { status: 403 });
  }

  const uploadedFile = formData?.get("file");
  const uploadResult = await uploadComplianceFile(supabase, uploadedFile instanceof File ? uploadedFile : null, document.school_id);

  if ("error" in uploadResult && uploadResult.error) {
    return Response.json({ error: uploadResult.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("compliance_documents")
    .insert({ ...document, ...uploadResult, uploaded_by: user.id })
    .select(documentSelect)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ document: data });
}
