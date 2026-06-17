import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type SchoolRouteContext = {
  params: Promise<{ id: string }>;
};

function cleanSchoolBody(body: Record<string, unknown> | null) {
  return {
    province_id: String(body?.province_id ?? "").trim(),
    name: String(body?.name ?? "").trim(),
    registration_number: String(body?.registration_number ?? "").trim() || null,
    city: String(body?.city ?? "").trim() || null,
    address: String(body?.address ?? "").trim() || null,
    contact_email: String(body?.contact_email ?? "").trim() || null,
    contact_phone: String(body?.contact_phone ?? "").trim() || null,
    logo_url: String(body?.logo_url ?? "").trim() || null,
    affiliation_status: String(body?.affiliation_status ?? "pending").trim() || "pending",
  };
}

export async function PATCH(request: Request, context: SchoolRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const school = cleanSchoolBody(body);

  if (!school.province_id || !school.name) {
    return Response.json({ error: "School name and province are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("schools")
    .update(school)
    .eq("id", id)
    .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,logo_url,affiliation_status,provinces(name,code)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ school: data });
}

export async function DELETE(request: Request, context: SchoolRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("schools").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
