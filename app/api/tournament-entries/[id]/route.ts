import { canAccessSchool, requireApprovedUser } from "@/lib/server/access";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { normalizeOptionalTournamentResult, normalizeTournamentCategory, tournamentPointsForResult } from "@/lib/tournamentRules";

type EntryRouteContext = {
  params: Promise<{ id: string }>;
};

function cleanEntryBody(body: Record<string, unknown> | null) {
  const medal = normalizeOptionalTournamentResult(String(body?.medal ?? body?.result ?? ""));
  const status = String(body?.status ?? "entered").trim() || "entered";

  return {
    tournament_id: String(body?.tournament_id ?? "").trim(),
    student_id: String(body?.student_id ?? "").trim(),
    school_id: String(body?.school_id ?? "").trim(),
    category: normalizeTournamentCategory(String(body?.category ?? "")) || null,
    result_label: String(body?.result_label ?? "").trim() || null,
    medal,
    points: medal ? tournamentPointsForResult(medal) : null,
    status,
  };
}

export async function PATCH(request: Request, context: EntryRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const entry = cleanEntryBody(body);
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("tournament_entries").select("school_id,status").eq("id", id).single();

  if (entry.status === "registered" && user.profile.role === "instructor") {
    return Response.json({ error: "Only school owners can manage tournament registrations." }, { status: 403 });
  }

  if (!existing || !(await canAccessSchool(supabase, user, existing.school_id)) || !(await canAccessSchool(supabase, user, entry.school_id))) {
    return Response.json({ error: "Tournament entry not found." }, { status: 404 });
  }

  const { data: duplicateEntry } = await supabase
    .from("tournament_entries")
    .select("id")
    .eq("tournament_id", entry.tournament_id)
    .eq("student_id", entry.student_id)
    .eq("category", entry.category)
    .neq("id", id)
    .maybeSingle();

  if (duplicateEntry) {
    return Response.json({ error: "This student is already registered for that tournament category." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tournament_entries")
    .update(entry)
    .eq("id", id)
    .select("id,tournament_id,student_id,school_id,category,result_label,medal,points,status,students(first_name,last_name,belt_rank),schools(name),tournaments(name)")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: user.id,
    action: "tournament_entry.updated",
    entityTable: "tournament_entries",
    entityId: id,
    summary: data.medal ? "Updated tournament result" : "Updated tournament registration",
    metadata: { school_id: data.school_id, medal: data.medal, points: data.points },
  });

  return Response.json({ entry: data });
}

export async function DELETE(request: Request, context: EntryRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("tournament_entries").select("school_id,status").eq("id", id).single();

  if (!existing || !(await canAccessSchool(supabase, user, existing.school_id))) {
    return Response.json({ error: "Tournament entry not found." }, { status: 404 });
  }

  if (existing.status === "registered" && user.profile.role === "instructor") {
    return Response.json({ error: "Only school owners can delete tournament registrations." }, { status: 403 });
  }

  const { error } = await supabase.from("tournament_entries").delete().eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: user.id,
    action: "tournament_entry.deleted",
    entityTable: "tournament_entries",
    entityId: id,
    summary: "Deleted tournament result",
  });

  return Response.json({ ok: true });
}
