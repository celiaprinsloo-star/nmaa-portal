import { requireAdmin } from "@/lib/server/requireAdmin";
import { paginationFromUrl, paginationPayload } from "@/lib/server/pagination";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const supabase = createSupabaseAdminClient();
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim();
  const search = url.searchParams.get("search")?.trim();
  const { page, pageSize, from, to } = paginationFromUrl(request.url);
  const query = supabase
    .from("school_orders")
    .select("id,school_id,submitted_by,contact_name,contact_email,notes,status,admin_notes,total_zar,total_usd,created_at,schools(name,contact_email),school_order_items(*)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) query.eq("status", status);
  if (search) query.or(`contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`);
  query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ orders: data, pagination: paginationPayload(page, pageSize, count) });
}
