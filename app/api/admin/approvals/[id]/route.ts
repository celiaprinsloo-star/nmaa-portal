import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { roles } from "@/lib/types";

type ApprovalRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: ApprovalRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const role = String(body.role ?? "");
  const provinceId = body.province_id ? String(body.province_id) : null;
  const schoolId = body.school_id ? String(body.school_id) : null;
  const rejectionReason = body.rejection_reason ? String(body.rejection_reason).trim() : null;

  if (action !== "approve" && action !== "reject") {
    return Response.json({ error: "Unknown approval action." }, { status: 400 });
  }

  if (action === "approve" && !roles.includes(role as never)) {
    return Response.json({ error: "Select a valid role before approving." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  if (action === "reject") {
    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: "rejected",
        role: null,
        province_id: null,
        school_id: null,
        rejection_reason: rejectionReason,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("approval_status", "pending");

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ ok: true });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      approval_status: "approved",
      role,
      province_id: provinceId,
      school_id: schoolId,
      rejection_reason: null,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("approval_status", "pending")
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (schoolId && (role === "school_owner" || role === "instructor")) {
    const { error: memberError } = await supabase.from("school_members").upsert(
      {
        school_id: schoolId,
        profile_id: id,
        role,
        is_primary: role === "school_owner",
      },
      { onConflict: "school_id,profile_id,role" },
    );

    if (memberError) {
      return Response.json({ error: memberError.message }, { status: 400 });
    }
  }

  return Response.json({ ok: true, profile });
}
