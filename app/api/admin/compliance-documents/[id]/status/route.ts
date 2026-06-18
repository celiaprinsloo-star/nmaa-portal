import { requireAdmin } from "@/lib/server/requireAdmin";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type StatusRouteContext = {
  params: Promise<{ id: string }>;
};

const allowedStatuses = new Set(["submitted", "approved", "rejected", "expired"]);

export async function PATCH(request: Request, context: StatusRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "").trim();

  if (!allowedStatuses.has(status)) {
    return Response.json({ error: "Select a valid compliance status." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("compliance_documents")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,status")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: user.id,
    action: "compliance_document.status_changed",
    entityTable: "compliance_documents",
    entityId: id,
    summary: `Compliance document marked ${status}`,
    metadata: { status },
  });

  return Response.json({ document: data });
}
