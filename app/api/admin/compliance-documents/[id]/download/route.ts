import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type DownloadRouteContext = {
  params: Promise<{ id: string }>;
};

const complianceBucket = "compliance-documents";

export async function GET(request: Request, context: DownloadRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: document, error } = await supabase
    .from("compliance_documents")
    .select("id,storage_path,file_name")
    .eq("id", id)
    .single();

  if (error || !document) {
    return Response.json({ error: "Compliance document not found." }, { status: 404 });
  }

  if (!document.storage_path) {
    return Response.json({ error: "This compliance record does not have an uploaded file." }, { status: 400 });
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(complianceBucket)
    .createSignedUrl(document.storage_path, 60 * 5, {
      download: document.file_name ?? true,
    });

  if (signedUrlError || !data?.signedUrl) {
    return Response.json({ error: signedUrlError?.message ?? "Unable to create download link." }, { status: 400 });
  }

  return Response.json({ url: data.signedUrl });
}
