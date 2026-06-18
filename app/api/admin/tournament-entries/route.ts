import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { normalizeTournamentCategory, normalizeTournamentResult, tournamentPointsForResult } from "@/lib/tournamentRules";

function cleanEntryBody(body: Record<string, unknown> | null) {
  return {
    tournament_id: String(body?.tournament_id ?? "").trim(),
    student_id: String(body?.student_id ?? "").trim(),
    school_id: String(body?.school_id ?? "").trim(),
    category: normalizeTournamentCategory(String(body?.category ?? "")) || null,
    placement: null,
    result_label: String(body?.result_label ?? "").trim() || null,
    medal: normalizeTournamentResult(String(body?.medal ?? body?.result ?? "")),
    points: tournamentPointsForResult(String(body?.medal ?? body?.result ?? "")),
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
  const { data, error } = await supabase
    .from("tournament_entries")
    .insert(entry)
    .select("id,tournament_id,student_id,school_id,category,placement,result_label,medal,points,status,students(first_name,last_name,belt_rank),schools(name),tournaments(name)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ entry: data });
}
