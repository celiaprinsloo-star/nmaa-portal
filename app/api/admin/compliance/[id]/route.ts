import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type ComplianceRouteContext = {
  params: Promise<{ id: string }>;
};

function cleanRequirementBody(body: Record<string, unknown> | null) {
  return {
    name: String(body?.name ?? "").trim(),
    description: String(body?.description ?? "").trim() || null,
    category: String(body?.category ?? "general").trim() || "general",
    applies_to: String(body?.applies_to ?? "instructor").trim() || "instructor",
    renewal_period_months: body?.renewal_period_months
      ? Number(body.renewal_period_months)
      : null,
    active: Boolean(body?.active ?? true),
  };
}

export async function PATCH(request: Request, context: ComplianceRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const requirement = cleanRequirementBody(body);

  if (!requirement.name) {
    return Response.json({ error: "Requirement name is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("compliance_requirements")
    .update(requirement)
    .eq("id", id)
    .select("id,name,description,category,applies_to,renewal_period_months,active")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ requirement: data });
}

export async function DELETE(request: Request, context: ComplianceRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("compliance_requirements").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
