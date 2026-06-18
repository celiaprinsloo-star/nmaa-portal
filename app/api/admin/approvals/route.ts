import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const [profilesResult, provincesResult, schoolsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from("provinces").select("id,name,code").order("name"),
    supabase
      .from("schools")
      .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,affiliation_status")
      .order("name"),
  ]);

  if (profilesResult.error) {
    return Response.json({ error: profilesResult.error.message }, { status: 400 });
  }

  if (provincesResult.error) {
    return Response.json({ error: provincesResult.error.message }, { status: 400 });
  }

  if (schoolsResult.error) {
    return Response.json({ error: schoolsResult.error.message }, { status: 400 });
  }

  return Response.json({
    profiles: profilesResult.data,
    provinces: provincesResult.data,
    schools: schoolsResult.data,
    admin_role: user.profile.role,
  });
}
