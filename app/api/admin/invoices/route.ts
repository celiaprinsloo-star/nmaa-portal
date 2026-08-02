import { requireApprovedUser } from "@/lib/server/access";
import { logAuditEvent } from "@/lib/server/audit";
import { paginationFromUrl, paginationPayload } from "@/lib/server/pagination";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const invoiceSelect = "id,school_id,invoice_number,title,description,amount_zar,status,due_date,admin_notes,created_by,created_at,updated_at,schools(name,contact_email)";
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
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role !== "super_admin") {
    return Response.json({ error: "Super admin access required for invoices." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("school_id")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const search = url.searchParams.get("search")?.trim();
  const { page, pageSize, from, to } = paginationFromUrl(request.url);

  const invoicesQuery = supabase
    .from("school_invoices")
    .select(invoiceSelect, { count: "exact" })
    .order("created_at", { ascending: false });

  if (schoolId) invoicesQuery.eq("school_id", schoolId);
  if (status) invoicesQuery.eq("status", status);
  if (search) invoicesQuery.or(`invoice_number.ilike.%${search}%,title.ilike.%${search}%`);
  invoicesQuery.range(from, to);

  const [invoicesResult, schoolsResult] = await Promise.all([
    invoicesQuery,
    supabase.from("schools").select("id,name,contact_email").order("name"),
  ]);

  if (invoicesResult.error) {
    return Response.json({ error: invoicesResult.error.message }, { status: 400 });
  }

  if (schoolsResult.error) {
    return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  }

  return Response.json({
    invoices: invoicesResult.data,
    schools: schoolsResult.data,
    pagination: paginationPayload(page, pageSize, invoicesResult.count),
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role !== "super_admin") {
    return Response.json({ error: "Super admin access required for invoices." }, { status: 403 });
  }

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
    .insert({ ...invoice, created_by: user.id })
    .select(invoiceSelect)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "school_invoice.created",
    entityTable: "school_invoices",
    entityId: data.id,
    summary: `Created invoice ${data.invoice_number}`,
    metadata: { school_id: data.school_id, amount_zar: data.amount_zar, status: data.status },
  });

  return Response.json({ invoice: data });
}
