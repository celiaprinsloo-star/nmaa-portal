import { hasAdminAccess } from "@/lib/server/auth";
import { requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const bucket = "portal-documents";
const maxFileSize = 15 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const documentSelect =
  "id,title,description,category,storage_path,file_name,file_type,file_size,active,created_at";

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("portal_documents")
    .select(documentSelect)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const documents = await Promise.all(
    data.map(async (document) => {
      const { data: signedData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(document.storage_path, 60 * 60);

      return { ...document, signed_url: signedData?.signedUrl ?? null };
    }),
  );

  return Response.json({ documents });
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (!hasAdminAccess(user.profile.role)) {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const title = String(formData?.get("title") ?? "").trim();
  const description = String(formData?.get("description") ?? "").trim() || null;
  const category = String(formData?.get("category") ?? "constitution").trim() || "constitution";

  if (!title) {
    return Response.json({ error: "Document title is required." }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a document to upload." }, { status: 400 });
  }

  if (!allowedTypes.has(file.type)) {
    return Response.json({ error: "Upload a PDF or Word document." }, { status: 400 });
  }

  if (file.size > maxFileSize) {
    return Response.json({ error: "Document must be smaller than 15MB." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${category}/${crypto.randomUUID()}-${cleanName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, await file.arrayBuffer(), {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("portal_documents")
    .insert({
      title,
      description,
      category,
      storage_path: storagePath,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select(documentSelect)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ document: data });
}
