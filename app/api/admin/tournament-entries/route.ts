import { requireAdmin } from "@/lib/server/requireAdmin";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { normalizeOptionalTournamentResult, normalizeTournamentCategory, tournamentPointsForResult } from "@/lib/tournamentRules";

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
    special_needs: Boolean(body?.special_needs),
    status: String(body?.status ?? "entered").trim() || "entered",
  };
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const entry = cleanEntryBody(body);

  if (!entry.tournament_id || !entry.student_id || !entry.school_id) {
    return Response.json({ error: "Tournament and student are required." }, { status: 400 });
  }

  if (!entry.category) {
    return Response.json({ error: "Select a valid tournament category." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingEntry } = await supabase
    .from("tournament_entries")
    .select("id")
    .eq("tournament_id", entry.tournament_id)
    .eq("student_id", entry.student_id)
    .eq("category", entry.category)
    .maybeSingle();

  if (existingEntry) {
    const { data, error } = await supabase
      .from("tournament_entries")
      .update({
        result_label: entry.result_label,
        medal: entry.medal,
        points: entry.points,
        special_needs: entry.special_needs,
        status: entry.status,
      })
      .eq("id", existingEntry.id)
      .select("id,tournament_id,student_id,school_id,category,result_label,medal,points,special_needs,status,students(first_name,last_name,belt_rank,date_of_birth,gender),schools(name),tournaments(name)")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    await logAuditEvent({
      actorId: user.id,
      action: "tournament_entry.updated",
      entityTable: "tournament_entries",
      entityId: data.id,
      summary: "Admin updated tournament result",
      metadata: { school_id: data.school_id, medal: data.medal, points: data.points },
    });

    return Response.json({ entry: data });
  }

  const { data, error } = await supabase
    .from("tournament_entries")
    .insert(entry)
    .select("id,tournament_id,student_id,school_id,category,result_label,medal,points,special_needs,status,students(first_name,last_name,belt_rank,date_of_birth,gender),schools(name),tournaments(name)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "tournament_entry.created",
    entityTable: "tournament_entries",
    entityId: data.id,
    summary: "Admin created tournament result",
    metadata: { school_id: data.school_id, medal: data.medal, points: data.points },
  });

  return Response.json({ entry: data });
}
