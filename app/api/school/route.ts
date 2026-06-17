import { requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function cleanSchoolBody(body: Record<string, unknown> | null) {
  return {
    name: String(body?.name ?? "").trim(),
    registration_number: String(body?.registration_number ?? "").trim() || null,
    city: String(body?.city ?? "").trim() || null,
    address: String(body?.address ?? "").trim() || null,
    contact_email: String(body?.contact_email ?? "").trim() || null,
    contact_phone: String(body?.contact_phone ?? "").trim() || null,
    logo_url: String(body?.logo_url ?? "").trim() || null,
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (!user.profile.school_id) {
    return Response.json({ error: "No school is linked to your profile." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("schools")
    .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,logo_url,affiliation_status,provinces(name,code)")
    .eq("id", user.profile.school_id)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ school: data });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role !== "school_owner" || !user.profile.school_id) {
    return Response.json({ error: "Only linked school owners can update school information." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const school = cleanSchoolBody(body);

  if (!school.name) {
    return Response.json({ error: "School name is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("schools")
    .update(school)
    .eq("id", user.profile.school_id)
    .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,logo_url,affiliation_status,provinces(name,code)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ school: data });
}
