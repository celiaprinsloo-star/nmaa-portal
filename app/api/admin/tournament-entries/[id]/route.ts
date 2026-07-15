import { requireAdmin } from "@/lib/server/requireAdmin";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { normalizeOptionalTournamentResult, normalizeTournamentCategory, tournamentPointsForResult } from "@/lib/tournamentRules";

type EntryRouteContext = {
  params: Promise<{ id: string }>;
};

function cleanEntryBody(body: Record<string, unknown> | null) {
  const medal = normalizeOptionalTournamentResult(String(body?.medal ?? body?.result ?? ""));

  return {
    tournament_id: String(body?.tournament_id ?? "").trim(),
    student_id: String(body?.student_id ?? "").trim(),
    school_id: String(body?.school_id ?? "").trim(),
    category: normalizeTournamentCategory(String(body?.category ?? "")) || null,
    result_label: String(body?.result_label ?? "").trim() || null,
    medal,
    points: medal ? tournamentPointsForResult(medal) : null,
    status: String(body?.status ?? "entered").trim() || "entered",
  };
}

export async function PATCH(request: Request, context: EntryRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const entry = cleanEntryBody(body);

  if (!entry.tournament_id || !entry.student_id || !entry.school_id) {
    return Response.json({ error: "Tournament and student are required." }, { status: 400 });
  }

  if (!entry.category) {
    return Response.json({ error: "Select a valid tournament category." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tournament_entries")
    .update(entry)
    .eq("id", id)
    .select("id,tournament_id,student_id,school_id,category,result_label,medal,points,status,students(first_name,last_name,belt_rank),schools(name),tournaments(name)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "tournament_entry.updated",
    entityTable: "tournament_entries",
    entityId: id,
    summary: "Admin updated tournament result",
    metadata: { school_id: data.school_id, medal: data.medal, points: data.points },
  });

  return Response.json({ entry: data });
}

export async function DELETE(request: Request, context: EntryRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("tournament_entries").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "tournament_entry.deleted",
    entityTable: "tournament_entries",
    entityId: id,
    summary: "Admin deleted tournament result",
  });

  return Response.json({ ok: true });
}
