import { requireAdmin } from "@/lib/server/requireAdmin";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const catalogSelect =
  "id,section,item,size,instructor_price,student_price,currency,note,special_order,in_stock,active,sort_order";

function cleanCatalogBody(body: Record<string, unknown> | null) {
  const item = String(body?.item ?? "").trim();
  const size = String(body?.size ?? "").trim();

  return {
    id: String(body?.id ?? `${item}-${size || "item"}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    section: String(body?.section ?? "").trim(),
    item,
    size: size || null,
    instructor_price: body?.instructor_price === "" || body?.instructor_price == null ? null : Number(body.instructor_price),
    student_price: body?.student_price === "" || body?.student_price == null ? null : Number(body.student_price),
    currency: String(body?.currency ?? "ZAR").trim() || "ZAR",
    note: String(body?.note ?? "").trim() || null,
    special_order: Boolean(body?.special_order),
    in_stock: Boolean(body?.in_stock ?? true),
    active: Boolean(body?.active ?? true),
    sort_order: Number(body?.sort_order ?? 999),
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_catalog_items")
    .select(catalogSelect)
    .order("sort_order")
    .order("section")
    .order("item");

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ items: data });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const body = await request.json().catch(() => null);
  const item = cleanCatalogBody(body);

  if (!item.id || !item.section || !item.item) {
    return Response.json({ error: "Section and item name are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_catalog_items")
    .insert(item)
    .select(catalogSelect)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "order_catalog.created",
    entityTable: "order_catalog_items",
    entityId: data.id,
    summary: `Created order item ${data.item}`,
  });

  return Response.json({ item: data });
}
