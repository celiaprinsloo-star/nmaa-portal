import { requireAdmin } from "@/lib/server/requireAdmin";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type OrderRouteContext = {
  params: Promise<{ id: string }>;
};

const allowedStatuses = new Set(["submitted", "processing", "ordered", "ready", "returned", "completed", "cancelled"]);
const allowedPaymentStatuses = new Set(["outstanding", "paid"]);

type OrderItemUpdate = {
  id?: string;
  quantity?: number;
  instructor_price?: number;
};

function invoiceNumber(orderId: string) {
  return `ORD-${orderId.slice(0, 8).toUpperCase()}`;
}

export async function PATCH(request: Request, context: OrderRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "").trim();
  const paymentStatus = String(body?.payment_status ?? "").trim();
  const adminNotes = String(body?.admin_notes ?? "").trim() || null;
  const discountZar = Math.max(0, Number(body?.discount_zar) || 0);
  const discountNote = String(body?.discount_note ?? "").trim() || null;
  const itemUpdates = Array.isArray(body?.items) ? (body.items as OrderItemUpdate[]) : [];

  if (!allowedStatuses.has(status)) {
    return Response.json({ error: "Choose a valid order status." }, { status: 400 });
  }

  if (!allowedPaymentStatuses.has(paymentStatus)) {
    return Response.json({ error: "Choose a valid payment status." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingOrder, error: existingOrderError } = await supabase
    .from("school_orders")
    .select("id,school_id,status,total_zar,total_usd,discount_zar,discount_note,school_order_items(id,quantity,currency,instructor_price,line_total,item,size)")
    .eq("id", id)
    .single();

  if (existingOrderError || !existingOrder) {
    return Response.json({ error: existingOrderError?.message ?? "Order not found." }, { status: 404 });
  }

  const { data: existingInvoice } = await supabase
    .from("school_invoices")
    .select("id")
    .eq("source_order_id", id)
    .maybeSingle();

  if (existingInvoice && (itemUpdates.length > 0 || discountZar !== Number(existingOrder.discount_zar ?? 0) || discountNote !== (existingOrder.discount_note ?? null))) {
    return Response.json({ error: "This order already has an invoice, so prices and discounts can no longer be changed." }, { status: 400 });
  }

  const orderItems = existingOrder.school_order_items ?? [];
  const updatesById = new Map(itemUpdates.map((item) => [String(item.id ?? ""), item]));
  const updatedItems = orderItems.map((item) => {
    const update = updatesById.get(item.id);
    const quantity = update ? Math.max(0, Number(update.quantity) || 0) : Number(item.quantity);
    const instructorPrice = update ? Math.max(0, Number(update.instructor_price) || 0) : Number(item.instructor_price ?? 0);
    return {
      ...item,
      quantity,
      instructor_price: instructorPrice,
      line_total: quantity * instructorPrice,
    };
  });

  if (!existingInvoice && itemUpdates.length > 0) {
    const itemErrors = await Promise.all(
      updatedItems.map((item) =>
        supabase
          .from("school_order_items")
          .update({
            quantity: item.quantity,
            instructor_price: item.instructor_price,
            line_total: item.line_total,
          })
          .eq("id", item.id),
      ),
    );
    const itemError = itemErrors.find((result) => result.error)?.error;
    if (itemError) {
      return Response.json({ error: itemError.message }, { status: 400 });
    }
  }

  const calculatedTotalZar = updatedItems
    .filter((item) => item.currency === "ZAR")
    .reduce((sum, item) => sum + Number(item.line_total), 0);
  const calculatedTotalUsd = updatedItems
    .filter((item) => item.currency === "USD")
    .reduce((sum, item) => sum + Number(item.line_total), 0);
  const finalTotalZar = Math.max(0, calculatedTotalZar - discountZar);

  const { data, error } = await supabase
    .from("school_orders")
    .update({
      status,
      payment_status: paymentStatus,
      admin_notes: adminNotes,
      discount_zar: discountZar,
      discount_note: discountNote,
      total_zar: finalTotalZar,
      total_usd: calculatedTotalUsd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,school_id,status,payment_status,admin_notes,discount_zar,discount_note,total_zar,total_usd")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (!existingInvoice && existingOrder.status !== "processing" && status === "processing") {
    const descriptionLines = [
      `Invoice created automatically from order ${id.slice(0, 8)} when moved to processing.`,
      discountZar > 0 ? `Discount applied: R${discountZar.toFixed(2)}${discountNote ? ` (${discountNote})` : ""}.` : "",
      calculatedTotalUsd > 0 ? `This order also includes USD items totaling $${calculatedTotalUsd.toFixed(2)}.` : "",
    ].filter(Boolean);

    const { error: invoiceError } = await supabase.from("school_invoices").insert({
      school_id: data.school_id,
      invoice_number: invoiceNumber(id),
      title: `Order ${id.slice(0, 8)} invoice`,
      description: descriptionLines.join(" "),
      amount_zar: data.total_zar,
      status: data.payment_status,
      admin_notes: data.admin_notes,
      source_order_id: id,
      created_by: user.id,
    });

    if (invoiceError) {
      return Response.json({ error: invoiceError.message }, { status: 400 });
    }
  }

  await logAuditEvent({
    actorId: user.id,
    action: "school_order.status_changed",
    entityTable: "school_orders",
    entityId: id,
    summary: `Order marked ${status} and ${paymentStatus}`,
    metadata: { status, payment_status: paymentStatus, discount_zar: discountZar, total_zar: finalTotalZar },
  });

  return Response.json({ order: data });
}
