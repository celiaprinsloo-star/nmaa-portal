import { requireApprovedUser } from "@/lib/server/access";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type InvoiceRouteContext = {
  params: Promise<{ id: string }>;
};

const invoiceSelect = "id,school_id,invoice_number,title,description,amount_zar,status,due_date,admin_notes,source_order_id,created_by,created_at,updated_at,schools(name,contact_email)";
const allowedStatuses = new Set(["outstanding", "paid", "cancelled"]);

function cleanInvoiceBody(body: Record<string, unknown> | null) {
  return {
    school_id: String(body?.school_id ?? "").trim(),
    invoice_number: String(body?.invoice_number ?? "").trim(),
    title: String(body?.title ?? "").trim(),
    description: String(body?.description ?? "").trim() || null,
    amount_zar: Math.max(0, Number(body?.amount_zar) || 0),
    status: String(body?.status ?? "outstanding").trim() || "outstanding",
    due_date: String(body?.due_date ?? "").trim() || null,
    admin_notes: String(body?.admin_notes ?? "").trim() || null,
    source_order_id: String(body?.source_order_id ?? "").trim() || null,
  };
}

export async function PATCH(request: Request, context: InvoiceRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role !== "super_admin") {
    return Response.json({ error: "Super admin access required for invoices." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const invoice = cleanInvoiceBody(body);

  if (!invoice.school_id || !invoice.invoice_number || !invoice.title) {
    return Response.json({ error: "School, invoice number, and title are required." }, { status: 400 });
  }

  if (!allowedStatuses.has(invoice.status)) {
    return Response.json({ error: "Choose a valid invoice status." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("school_invoices")
    .update({ ...invoice, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(invoiceSelect)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "school_invoice.updated",
    entityTable: "school_invoices",
    entityId: id,
    summary: `Updated invoice ${data.invoice_number}`,
    metadata: { school_id: data.school_id, amount_zar: data.amount_zar, status: data.status },
  });

  return Response.json({ invoice: data });
}

export async function POST(request: Request, context: InvoiceRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role !== "super_admin") {
    return Response.json({ error: "Super admin access required for invoices." }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("school_invoices")
    .select("id,source_order_id")
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    return Response.json({ error: invoiceError?.message ?? "Invoice not found." }, { status: 404 });
  }

  if (!invoice.source_order_id) {
    return Response.json({ error: "This invoice is not linked to an order." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("school_orders")
    .select("id,school_id,payment_status,admin_notes,discount_zar,discount_note,school_order_items(id,currency,line_total)")
    .eq("id", invoice.source_order_id)
    .single();

  if (orderError || !order) {
    return Response.json({ error: orderError?.message ?? "Linked order not found." }, { status: 404 });
  }

  const items = order.school_order_items ?? [];
  const calculatedTotalZar = items
    .filter((item) => item.currency === "ZAR")
    .reduce((sum, item) => sum + Number(item.line_total), 0);
  const calculatedTotalUsd = items
    .filter((item) => item.currency === "USD")
    .reduce((sum, item) => sum + Number(item.line_total), 0);
  const discountZar = Math.max(0, Number(order.discount_zar ?? 0) || 0);
  const finalTotalZar = Math.max(0, calculatedTotalZar - discountZar);
  const descriptionLines = [
    `Invoice synced from linked order ${order.id.slice(0, 8)}.`,
    discountZar > 0 ? `Discount applied: R${discountZar.toFixed(2)}${order.discount_note ? ` (${order.discount_note})` : ""}.` : "",
    calculatedTotalUsd > 0 ? `This order also includes USD items totaling $${calculatedTotalUsd.toFixed(2)}.` : "",
  ].filter(Boolean);

  const { error: orderUpdateError } = await supabase
    .from("school_orders")
    .update({
      total_zar: finalTotalZar,
      total_usd: calculatedTotalUsd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (orderUpdateError) {
    return Response.json({ error: orderUpdateError.message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("school_invoices")
    .update({
      amount_zar: finalTotalZar,
      status: order.payment_status,
      description: descriptionLines.join(" "),
      admin_notes: order.admin_notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(invoiceSelect)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "school_invoice.synced_from_order",
    entityTable: "school_invoices",
    entityId: id,
    summary: `Synced invoice ${data.invoice_number} from linked order`,
    metadata: { school_id: data.school_id, source_order_id: data.source_order_id, amount_zar: data.amount_zar },
  });

  return Response.json({ invoice: data });
}

export async function DELETE(request: Request, context: InvoiceRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role !== "super_admin") {
    return Response.json({ error: "Super admin access required for invoices." }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("school_invoices").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "school_invoice.deleted",
    entityTable: "school_invoices",
    entityId: id,
    summary: "Deleted school invoice",
  });

  return Response.json({ ok: true });
}
