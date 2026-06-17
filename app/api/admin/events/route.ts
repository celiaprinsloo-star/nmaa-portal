import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const eventSelect =
  "id,province_id,school_id,title,event_type,description,venue,starts_at,ends_at,capacity,status,provinces(name,code),schools(name)";

function cleanEventBody(body: Record<string, unknown> | null) {
  return {
    province_id: String(body?.province_id ?? "").trim() || null,
    school_id: String(body?.school_id ?? "").trim() || null,
    title: String(body?.title ?? "").trim(),
    event_type: String(body?.event_type ?? "general").trim() || "general",
    description: String(body?.description ?? "").trim() || null,
    venue: String(body?.venue ?? "").trim() || null,
    starts_at: String(body?.starts_at ?? "").trim(),
    ends_at: String(body?.ends_at ?? "").trim() || null,
    capacity: body?.capacity === "" || body?.capacity == null ? null : Number(body.capacity),
    status: String(body?.status ?? "open").trim() || "open",
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const supabase = createSupabaseAdminClient();
  const [eventsResult, bookingsResult, provincesResult, schoolsResult] = await Promise.all([
    supabase.from("events").select(eventSelect).order("starts_at", { ascending: false }),
    supabase
      .from("event_bookings")
      .select("id,event_id,profile_id,school_id,attendee_name,attendee_email,attendee_phone,attendee_type,notes,status,created_at,events(title,starts_at),schools(name)")
      .order("created_at", { ascending: false }),
    supabase.from("provinces").select("id,name,code").order("name"),
    supabase.from("schools").select("id,province_id,name").order("name"),
  ]);

  if (eventsResult.error) return Response.json({ error: eventsResult.error.message }, { status: 400 });
  if (bookingsResult.error) return Response.json({ error: bookingsResult.error.message }, { status: 400 });
  if (provincesResult.error) return Response.json({ error: provincesResult.error.message }, { status: 400 });
  if (schoolsResult.error) return Response.json({ error: schoolsResult.error.message }, { status: 400 });

  const events = eventsResult.data.map((event) => ({
    ...event,
    booking_count: bookingsResult.data.filter((booking) => booking.event_id === event.id).length,
  }));

  return Response.json({
    events,
    bookings: bookingsResult.data,
    provinces: provincesResult.data,
    schools: schoolsResult.data,
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const body = await request.json().catch(() => null);
  const event = cleanEventBody(body);

  if (!event.title || !event.starts_at) {
    return Response.json({ error: "Event title and start date/time are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("events").insert(event).select(eventSelect).single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ event: data });
}
