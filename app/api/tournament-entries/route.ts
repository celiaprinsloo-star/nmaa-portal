import { canAccessSchool, getAllowedSchoolIds, requireApprovedUser } from "@/lib/server/access";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { normalizeOptionalTournamentResult, normalizeTournamentCategory, tournamentPointsForResult } from "@/lib/tournamentRules";

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
    special_needs: Boolean(body?.special_needs),
    status,
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const supabase = createSupabaseAdminClient();
  const { schoolIds, error: schoolError } = await getAllowedSchoolIds(supabase, user);

  if (schoolError) return Response.json({ error: schoolError }, { status: 400 });

  const entriesQuery = supabase
    .from("tournament_entries")
    .select("id,tournament_id,student_id,school_id,category,result_label,medal,points,special_needs,status,students(first_name,last_name,belt_rank,date_of_birth,gender),schools(name),tournaments(name)")
    .order("created_at", { ascending: false });
  const studentsQuery = supabase
    .from("students")
    .select("id,school_id,first_name,last_name,belt_rank,schools(name)")
    .order("last_name");
  const tournamentsQuery = supabase
    .from("tournaments")
    .select("id,province_id,name,venue,starts_at,ends_at,registration_closes_at,age_calculation_basis,fee_structure,tournament_categories,provinces(name,code)")
    .order("starts_at", { ascending: false });

  if (schoolIds.length > 0) {
    entriesQuery.in("school_id", schoolIds);
    studentsQuery.in("school_id", schoolIds);
  } else {
    entriesQuery.eq("school_id", "00000000-0000-0000-0000-000000000000");
    studentsQuery.eq("school_id", "00000000-0000-0000-0000-000000000000");
  }

  const feePaymentsQuery = supabase
    .from("tournament_school_fee_payments")
    .select("id,tournament_id,school_id,status,amount_zar,paid_at");

  if (schoolIds.length > 0) {
    feePaymentsQuery.in("school_id", schoolIds);
  } else {
    feePaymentsQuery.eq("school_id", "00000000-0000-0000-0000-000000000000");
  }

  const [entriesResult, studentsResult, tournamentsResult, feePaymentsResult] = await Promise.all([
    entriesQuery,
    studentsQuery,
    tournamentsQuery,
    feePaymentsQuery,
  ]);

  if (entriesResult.error) return Response.json({ error: entriesResult.error.message }, { status: 400 });
  if (studentsResult.error) return Response.json({ error: studentsResult.error.message }, { status: 400 });
  if (tournamentsResult.error) return Response.json({ error: tournamentsResult.error.message }, { status: 400 });
  if (feePaymentsResult.error && feePaymentsResult.error.code !== "42P01") {
    return Response.json({ error: feePaymentsResult.error.message }, { status: 400 });
  }

  return Response.json({
    entries: entriesResult.data,
    students: studentsResult.data,
    tournaments: tournamentsResult.data,
    feePayments: feePaymentsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const body = await request.json().catch(() => null);
  const entry = cleanEntryBody(body);

  if (!entry.tournament_id || !entry.student_id || !entry.school_id) {
    return Response.json({ error: "Tournament and student are required." }, { status: 400 });
  }

  if (!entry.category) {
    return Response.json({ error: "Select a valid tournament category." }, { status: 400 });
  }

  if (entry.status === "registered" && user.profile.role === "instructor") {
    return Response.json({ error: "Only school owners can register students for tournaments." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!(await canAccessSchool(supabase, user, entry.school_id))) {
    return Response.json({ error: "You cannot add tournament events for that school." }, { status: 403 });
  }

  const { data: existingEntry } = await supabase
    .from("tournament_entries")
    .select("id,school_id")
    .eq("tournament_id", entry.tournament_id)
    .eq("student_id", entry.student_id)
    .eq("category", entry.category)
    .maybeSingle();

  if (existingEntry) {
    const isResultSubmission = Boolean(entry.medal || entry.result_label || entry.status !== "registered");

    if (isResultSubmission) {
      if (!(await canAccessSchool(supabase, user, existingEntry.school_id))) {
        return Response.json({ error: "Tournament event not found." }, { status: 404 });
      }

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

      if (error) return Response.json({ error: error.message }, { status: 400 });

      await logAuditEvent({
        actorId: user.id,
        action: "tournament_entry.updated",
        entityTable: "tournament_entries",
        entityId: data.id,
        summary: "Updated tournament result",
        metadata: { school_id: data.school_id, medal: data.medal, points: data.points },
      });

      return Response.json({ entry: data });
    }

    return Response.json({ error: "This student is already registered for that tournament category." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tournament_entries")
    .insert(entry)
    .select("id,tournament_id,student_id,school_id,category,result_label,medal,points,special_needs,status,students(first_name,last_name,belt_rank,date_of_birth,gender),schools(name),tournaments(name)")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: user.id,
    action: "tournament_entry.created",
    entityTable: "tournament_entries",
    entityId: data.id,
    summary: data.medal ? "Created tournament result" : "Registered student for tournament",
    metadata: { school_id: data.school_id, medal: data.medal, points: data.points },
  });

  return Response.json({ entry: data });
}
