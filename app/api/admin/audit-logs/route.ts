import { requireAdmin } from "@/lib/server/requireAdmin";
import { paginationFromUrl, paginationPayload } from "@/lib/server/pagination";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const url = new URL(request.url);
  const action = url.searchParams.get("action")?.trim();
  const entityTable = url.searchParams.get("entity_table")?.trim();
  const { page, pageSize, from, to } = paginationFromUrl(request.url, 50);

  const supabase = createSupabaseAdminClient();
  const query = supabase
    .from("audit_logs")
    .select("id,actor_profile_id,action,entity_table,entity_id,summary,metadata,created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (action) query.eq("action", action);
  if (entityTable) query.eq("entity_table", entityTable);
  query.range(from, to);

  const { data, error, count } = await query;

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ logs: data, pagination: paginationPayload(page, pageSize, count) });
}
