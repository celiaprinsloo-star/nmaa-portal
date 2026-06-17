import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type OrderRouteContext = {
  params: Promise<{ id: string }>;
};

const allowedStatuses = new Set(["submitted", "processing", "ordered", "ready", "completed", "cancelled"]);

export async function PATCH(request: Request, context: OrderRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "").trim();
  const adminNotes = String(body?.admin_notes ?? "").trim() || null;

  if (!allowedStatuses.has(status)) {
    return Response.json({ error: "Choose a valid order status." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("school_orders")
    .update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,status,admin_notes")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ order: data });
}
