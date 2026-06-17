import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type CatalogRouteContext = {
  params: Promise<{ id: string }>;
};

const catalogSelect =
  "id,section,item,size,instructor_price,student_price,currency,note,special_order,in_stock,active,sort_order";

function cleanCatalogBody(body: Record<string, unknown> | null) {
  return {
    section: String(body?.section ?? "").trim(),
    item: String(body?.item ?? "").trim(),
    size: String(body?.size ?? "").trim() || null,
    instructor_price: body?.instructor_price === "" || body?.instructor_price == null ? null : Number(body.instructor_price),
    student_price: body?.student_price === "" || body?.student_price == null ? null : Number(body.student_price),
    currency: String(body?.currency ?? "ZAR").trim() || "ZAR",
    note: String(body?.note ?? "").trim() || null,
    special_order: Boolean(body?.special_order),
    in_stock: Boolean(body?.in_stock),
    active: Boolean(body?.active),
    sort_order: Number(body?.sort_order ?? 999),
    updated_at: new Date().toISOString(),
  };
}

export async function PATCH(request: Request, context: CatalogRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const item = cleanCatalogBody(body);

  if (!item.section || !item.item) {
    return Response.json({ error: "Section and item name are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_catalog_items")
    .update(item)
    .eq("id", id)
    .select(catalogSelect)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ item: data });
}
