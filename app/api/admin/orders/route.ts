import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("school_orders")
    .select("id,school_id,submitted_by,contact_name,contact_email,notes,status,admin_notes,total_zar,total_usd,created_at,schools(name,contact_email),school_order_items(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ orders: data });
}
