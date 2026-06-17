import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type ProvinceRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: ProvinceRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim().toUpperCase();

  if (!name || !code) {
    return Response.json({ error: "Province name and code are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("provinces")
    .update({ name, code })
    .eq("id", id)
    .select("id,name,code,created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ province: data });
}

export async function DELETE(request: Request, context: ProvinceRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("provinces").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
