import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function cleanTournamentBody(body: Record<string, unknown> | null) {
  const rawFeeStructure = body?.fee_structure;
  const feeStructure =
    rawFeeStructure && typeof rawFeeStructure === "object" && !Array.isArray(rawFeeStructure)
      ? Object.entries(rawFeeStructure as Record<string, unknown>).reduce<Record<string, number>>((fees, [category, value]) => {
          const fee = Number(value);
          if (Number.isFinite(fee) && fee >= 0) fees[category] = fee;
          return fees;
        }, {})
      : {};

  return {
    province_id: String(body?.province_id ?? "").trim() || null,
    name: String(body?.name ?? "").trim(),
    venue: String(body?.venue ?? "").trim() || null,
    starts_at: String(body?.starts_at ?? "").trim(),
    ends_at: String(body?.ends_at ?? "").trim() || null,
    registration_closes_at: String(body?.registration_closes_at ?? "").trim() || null,
    fee_structure: feeStructure,
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const [tournamentsResult, entriesResult, provincesResult, studentsResult] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id,province_id,name,venue,starts_at,ends_at,registration_closes_at,fee_structure,provinces(name,code)")
      .order("starts_at", { ascending: false }),
    supabase
      .from("tournament_entries")
      .select("id,tournament_id,student_id,school_id,category,result_label,medal,points,status,students(first_name,last_name,belt_rank),schools(name),tournaments(name)")
      .order("created_at", { ascending: false }),
    supabase.from("provinces").select("id,name,code").order("name"),
    supabase
      .from("students")
      .select("id,school_id,first_name,last_name,belt_rank,schools(name)")
      .order("last_name"),
  ]);

  if (tournamentsResult.error) {
    return Response.json({ error: tournamentsResult.error.message }, { status: 400 });
  }

  if (entriesResult.error) {
    return Response.json({ error: entriesResult.error.message }, { status: 400 });
  }

  if (provincesResult.error) {
    return Response.json({ error: provincesResult.error.message }, { status: 400 });
  }

  if (studentsResult.error) {
    return Response.json({ error: studentsResult.error.message }, { status: 400 });
  }

  const leaderboardMap = new Map<
    string,
    {
      school_id: string;
      school_name: string;
      points: number;
      gold: number;
      silver: number;
      bronze: number;
      results: number;
      entries: number;
    }
  >();

  for (const entry of entriesResult.data) {
    const schoolId = entry.school_id;
    const schoolRelation = Array.isArray(entry.schools) ? entry.schools[0] : entry.schools;
    const current = leaderboardMap.get(schoolId) ?? {
      school_id: schoolId,
      school_name: schoolRelation?.name ?? "Unknown school",
      points: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      results: 0,
      entries: 0,
    };

    current.entries += 1;
    current.points += Number(entry.points ?? 0);
    if (entry.medal || entry.result_label) current.results += 1;
    if (entry.medal === "gold") current.gold += 1;
    if (entry.medal === "silver") current.silver += 1;
    if (entry.medal === "bronze") current.bronze += 1;
    leaderboardMap.set(schoolId, current);
  }

  const leaderboard = Array.from(leaderboardMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    return b.bronze - a.bronze;
  });

  return Response.json({
    tournaments: tournamentsResult.data,
    entries: entriesResult.data,
    provinces: provincesResult.data,
    students: studentsResult.data,
    leaderboard,
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const tournament = cleanTournamentBody(body);

  if (!tournament.name || !tournament.starts_at) {
    return Response.json({ error: "Tournament name and date are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tournaments")
    .insert(tournament)
    .select("id,province_id,name,venue,starts_at,ends_at,registration_closes_at,fee_structure,provinces(name,code)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ tournament: data });
}
