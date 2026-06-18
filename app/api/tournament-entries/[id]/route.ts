import { canAccessSchool, requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { normalizeTournamentCategory, normalizeTournamentResult, tournamentPointsForResult } from "@/lib/tournamentRules";

type EntryRouteContext = {
  params: Promise<{ id: string }>;
};

function cleanEntryBody(body: Record<string, unknown> | null) {
  return {
    tournament_id: String(body?.tournament_id ?? "").trim(),
    student_id: String(body?.student_id ?? "").trim(),
    school_id: String(body?.school_id ?? "").trim(),
    category: normalizeTournamentCategory(String(body?.category ?? "")) || null,
    placement: body?.placement ? Number(body.placement) : null,
    result_label: String(body?.result_label ?? "").trim() || null,
    medal: normalizeTournamentResult(String(body?.medal ?? body?.result ?? "")),
    points: tournamentPointsForResult(String(body?.medal ?? body?.result ?? "")),
    status: String(body?.status ?? "entered").trim() || "entered",
  };
}

export async function PATCH(request: Request, context: EntryRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const entry = cleanEntryBody(body);
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("tournament_entries").select("school_id").eq("id", id).single();

  if (!existing || !(await canAccessSchool(supabase, user, existing.school_id)) || !(await canAccessSchool(supabase, user, entry.school_id))) {
    return Response.json({ error: "Tournament entry not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("tournament_entries")
    .update(entry)
    .eq("id", id)
    .select("id,tournament_id,student_id,school_id,category,placement,result_label,medal,points,status,students(first_name,last_name,belt_rank),schools(name),tournaments(name)")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ entry: data });
}

export async function DELETE(request: Request, context: EntryRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("tournament_entries").select("school_id").eq("id", id).single();

  if (!existing || !(await canAccessSchool(supabase, user, existing.school_id))) {
    return Response.json({ error: "Tournament entry not found." }, { status: 404 });
  }

  const { error } = await supabase.from("tournament_entries").delete().eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
