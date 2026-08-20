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
