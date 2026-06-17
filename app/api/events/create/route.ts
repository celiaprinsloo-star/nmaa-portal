import { requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const eventSelect =
  "id,province_id,school_id,title,event_type,description,venue,starts_at,ends_at,capacity,status,provinces(name,code),schools(name)";

function cleanEventBody(body: Record<string, unknown> | null) {
  return {
    title: String(body?.title ?? "").trim(),
    event_type: String(body?.event_type ?? "school_event").trim() || "school_event",
    description: String(body?.description ?? "").trim() || null,
    venue: String(body?.venue ?? "").trim() || null,
    starts_at: String(body?.starts_at ?? "").trim(),
    ends_at: String(body?.ends_at ?? "").trim() || null,
    capacity: body?.capacity === "" || body?.capacity == null ? null : Number(body.capacity),
  };
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (user.profile.role !== "school_owner" || !user.profile.school_id) {
    return Response.json({ error: "Only linked school owners can create school events." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const event = cleanEventBody(body);

  if (!event.title || !event.starts_at) {
    return Response.json({ error: "Event name and start date/time are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("id,province_id")
    .eq("id", user.profile.school_id)
    .single();

  if (schoolError || !school) {
    return Response.json({ error: "Linked school not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      ...event,
      province_id: school.province_id,
      school_id: school.id,
      status: "open",
    })
    .select(eventSelect)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ event: data });
}
