import { requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { OrderCatalogItem } from "@/lib/types";

type RequestedItem = {
  catalog_item_id?: string;
  quantity?: number;
};

function buildOrderItems(items: RequestedItem[], catalog: OrderCatalogItem[]) {
  return items
    .map((requested) => {
      const catalogItem = catalog.find((item) => item.id === requested.catalog_item_id && item.active && item.in_stock);
      const quantity = Math.max(0, Number(requested.quantity) || 0);

      if (!catalogItem || quantity <= 0) return null;

      const lineTotal = catalogItem.instructor_price ? catalogItem.instructor_price * quantity : 0;

      return {
        catalog_item_id: catalogItem.id,
        section: catalogItem.section,
        item: catalogItem.item,
        size: catalogItem.size ?? null,
        quantity,
        currency: catalogItem.currency,
        instructor_price: catalogItem.instructor_price ?? null,
        student_price: catalogItem.student_price ?? null,
        line_total: lineTotal,
        note: catalogItem.note ?? null,
        special_order: Boolean(catalogItem.special_order),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (!user.profile.school_id) {
    return Response.json({ error: "No school linked to your profile." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("school_orders")
    .select("id,school_id,submitted_by,contact_name,contact_email,notes,status,admin_notes,total_zar,total_usd,created_at,school_order_items(*)")
    .eq("school_id", user.profile.school_id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ orders: data });
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role !== "school_owner" || !user.profile.school_id) {
    return Response.json({ error: "Only linked school owners can submit orders." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const supabase = createSupabaseAdminClient();
  const { data: catalog, error: catalogError } = await supabase
    .from("order_catalog_items")
    .select("id,section,item,size,instructor_price,student_price,currency,note,special_order,in_stock,active,sort_order")
    .eq("active", true);

  if (catalogError) {
    return Response.json({ error: catalogError.message }, { status: 400 });
  }

  const orderItems = buildOrderItems(Array.isArray(body?.items) ? body.items : [], catalog as OrderCatalogItem[]);

  if (orderItems.length === 0) {
    return Response.json({ error: "Add at least one item to submit an order." }, { status: 400 });
  }

  const totalZar = orderItems
    .filter((item) => item.currency === "ZAR")
    .reduce((sum, item) => sum + item.line_total, 0);
  const totalUsd = orderItems
    .filter((item) => item.currency === "USD")
    .reduce((sum, item) => sum + item.line_total, 0);

  const { data: order, error: orderError } = await supabase
    .from("school_orders")
    .insert({
      school_id: user.profile.school_id,
      submitted_by: user.id,
      contact_name: String(body?.contact_name ?? user.profile.full_name ?? "").trim() || null,
      contact_email: String(body?.contact_email ?? user.email ?? "").trim() || null,
      notes: String(body?.notes ?? "").trim() || null,
      total_zar: totalZar,
      total_usd: totalUsd,
    })
    .select("id")
    .single();

  if (orderError) {
    return Response.json({ error: orderError.message }, { status: 400 });
  }

  const { error: itemsError } = await supabase
    .from("school_order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (itemsError) {
    await supabase.from("school_orders").delete().eq("id", order.id);
    return Response.json({ error: itemsError.message }, { status: 400 });
  }

  return Response.json({ order_id: order.id });
}
