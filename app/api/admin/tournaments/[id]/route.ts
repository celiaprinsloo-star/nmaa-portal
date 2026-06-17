import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type TournamentRouteContext = {
  params: Promise<{ id: string }>;
};

function cleanTournamentBody(body: Record<string, unknown> | null) {
  return {
    province_id: String(body?.province_id ?? "").trim() || null,
    name: String(body?.name ?? "").trim(),
    venue: String(body?.venue ?? "").trim() || null,
    starts_at: String(body?.starts_at ?? "").trim(),
    ends_at: String(body?.ends_at ?? "").trim() || null,
    registration_closes_at: String(body?.registration_closes_at ?? "").trim() || null,
  };
}

export async function PATCH(request: Request, context: TournamentRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const tournament = cleanTournamentBody(body);

  if (!tournament.name || !tournament.starts_at) {
    return Response.json({ error: "Tournament name and date are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tournaments")
    .update(tournament)
    .eq("id", id)
    .select("id,province_id,name,venue,starts_at,ends_at,registration_closes_at,provinces(name,code)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ tournament: data });
}

export async function DELETE(request: Request, context: TournamentRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("tournaments").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
