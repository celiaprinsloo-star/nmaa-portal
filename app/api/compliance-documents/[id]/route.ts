import { canAccessSchool, requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type DocumentRouteContext = {
  params: Promise<{ id: string }>;
};

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

export async function PATCH(request: Request, context: DocumentRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role === "instructor") {
    return Response.json({ error: "Compliance documents are managed by school owners and admins." }, { status: 403 });
  }

  const { id } = await context.params;
  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
  const formData = isMultipart ? await request.formData().catch(() => null) : null;
  const body = isMultipart ? null : await request.json().catch(() => null);
  const document = formData ? cleanDocumentForm(formData) : cleanDocumentBody(body);

  if (!document.school_id || !document.document_name) {
    return Response.json({ error: "School and document name are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("compliance_documents").select("school_id").eq("id", id).single();

  if (!existing?.school_id || !(await canAccessSchool(supabase, user, existing.school_id)) || !(await canAccessSchool(supabase, user, document.school_id))) {
    return Response.json({ error: "Compliance document not found." }, { status: 404 });
  }

  const uploadedFile = formData?.get("file");
  const uploadResult = await uploadComplianceFile(supabase, uploadedFile instanceof File ? uploadedFile : null, document.school_id);

  if ("error" in uploadResult && uploadResult.error) {
    return Response.json({ error: uploadResult.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("compliance_documents")
    .update({ ...document, ...uploadResult })
    .eq("id", id)
    .select(documentSelect)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ document: data });
}

export async function DELETE(request: Request, context: DocumentRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role === "instructor") {
    return Response.json({ error: "Compliance documents are managed by school owners and admins." }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("compliance_documents").select("school_id").eq("id", id).single();

  if (!existing?.school_id || !(await canAccessSchool(supabase, user, existing.school_id))) {
    return Response.json({ error: "Compliance document not found." }, { status: 404 });
  }

  const { error } = await supabase.from("compliance_documents").delete().eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
