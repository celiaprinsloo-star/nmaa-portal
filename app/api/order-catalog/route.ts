import { requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const catalogSelect =
  "id,section,item,size,instructor_price,student_price,currency,note,special_order,in_stock,active,sort_order";

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_catalog_items")
    .select(catalogSelect)
    .eq("active", true)
    .order("sort_order")
    .order("section")
    .order("item");

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ items: data });
}
