import { requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const invoiceSelect = "id,school_id,invoice_number,title,description,amount_zar,status,due_date,admin_notes,source_order_id,created_by,created_at,updated_at,schools(name,contact_email)";

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role !== "school_owner" || !user.profile.school_id) {
    return Response.json({ error: "Only linked school owners can view school invoices." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("school_invoices")
    .select(invoiceSelect)
    .eq("school_id", user.profile.school_id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ invoices: data });
}
