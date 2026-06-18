import { hasAdminAccess } from "@/lib/server/auth";
import { getAllowedSchoolIds, requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type CalendarItem = {
  id: string;
  type: "event" | "tournament" | "compliance";
  title: string;
  date: string;
  end_date: string | null;
  location: string | null;
  status: string | null;
  owner: string | null;
  href: string;
};

function relatedName(value: { name?: string | null } | { name?: string | null }[] | null | undefined) {
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value?.name ?? null;
}

function isVisibleEvent(
  event: { province_id: string | null; school_id: string | null; status: string },
  role: string | null,
  provinceId: string | null,
  schoolIds: string[],
) {
  if (hasAdminAccess(role as never)) return true;
  if (role === "provincial_admin") {
    return !event.province_id || event.province_id === provinceId || Boolean(event.school_id && schoolIds.includes(event.school_id));
  }
  return (
    ["open", "published"].includes(event.status) &&
    (!event.school_id || schoolIds.includes(event.school_id)) &&
    (!event.province_id || event.province_id === provinceId)
  );
}

function isVisibleTournament(
  tournament: { province_id: string | null },
  role: string | null,
  provinceId: string | null,
) {
  if (hasAdminAccess(role as never)) return true;
  return !tournament.province_id || tournament.province_id === provinceId;
}

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const supabase = createSupabaseAdminClient();
  const { schoolIds, error: schoolError } = await getAllowedSchoolIds(supabase, user);

  if (schoolError) return Response.json({ error: schoolError }, { status: 400 });

  const [{ data: profileSchool }, eventsResult, tournamentsResult, documentsResult] = await Promise.all([
    user.profile.school_id
      ? supabase.from("schools").select("id,province_id,name").eq("id", user.profile.school_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("events")
      .select("id,province_id,school_id,title,event_type,venue,starts_at,ends_at,status,schools(name)")
      .order("starts_at", { ascending: true }),
    supabase
      .from("tournaments")
      .select("id,province_id,name,venue,starts_at,ends_at,provinces(name)")
      .order("starts_at", { ascending: true }),
    supabase
      .from("compliance_documents")
      .select("id,school_id,document_name,status,expires_at,schools(name),compliance_requirements(name)")
      .not("expires_at", "is", null)
      .order("expires_at", { ascending: true }),
  ]);

  if (eventsResult.error) return Response.json({ error: eventsResult.error.message }, { status: 400 });
  if (tournamentsResult.error) return Response.json({ error: tournamentsResult.error.message }, { status: 400 });
  if (documentsResult.error) return Response.json({ error: documentsResult.error.message }, { status: 400 });

  const provinceId = user.profile.province_id ?? profileSchool?.province_id ?? null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventItems: CalendarItem[] = eventsResult.data
    .filter((event) => isVisibleEvent(event, user.profile.role, provinceId, schoolIds))
    .map((event) => ({
      id: event.id,
      type: "event",
      title: event.title,
      date: event.starts_at,
      end_date: event.ends_at,
      location: event.venue,
      status: event.status,
      owner: relatedName(event.schools) ?? "NMAA SA",
      href: hasAdminAccess(user.profile.role) ? "/admin/events" : "/school/events",
    }));

  const tournamentItems: CalendarItem[] = tournamentsResult.data
    .filter((tournament) => isVisibleTournament(tournament, user.profile.role, provinceId))
    .map((tournament) => ({
      id: tournament.id,
      type: "tournament",
      title: tournament.name,
      date: tournament.starts_at,
      end_date: tournament.ends_at,
      location: tournament.venue,
      status: null,
      owner: relatedName(tournament.provinces) ?? "National",
      href: hasAdminAccess(user.profile.role) ? "/admin/tournaments" : "/school/results",
    }));

  const canSeeCompliance = user.profile.role !== "instructor";
  const complianceItems: CalendarItem[] = canSeeCompliance
    ? documentsResult.data
        .filter((document) => {
          if (!document.expires_at) return false;
          if (hasAdminAccess(user.profile.role)) return true;
          return Boolean(document.school_id && schoolIds.includes(document.school_id));
        })
        .map((document) => ({
          id: document.id,
          type: "compliance",
          title: `${relatedName(document.compliance_requirements) ?? document.document_name} expires`,
          date: document.expires_at as string,
          end_date: null,
          location: null,
          status: document.status,
          owner: relatedName(document.schools),
          href: hasAdminAccess(user.profile.role) ? "/admin/compliance" : "/school/compliance",
        }))
    : [];

  const items = [...eventItems, ...tournamentItems, ...complianceItems]
    .filter((item) => new Date(item.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return Response.json({ items });
}
