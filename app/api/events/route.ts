import { canAccessSchool, requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function cleanBookingBody(body: Record<string, unknown> | null) {
  return {
    event_id: String(body?.event_id ?? "").trim(),
    attendee_name: String(body?.attendee_name ?? "").trim(),
    attendee_email: String(body?.attendee_email ?? "").trim() || null,
    attendee_phone: String(body?.attendee_phone ?? "").trim() || null,
    attendee_type: String(body?.attendee_type ?? "student").trim() || "student",
    notes: String(body?.notes ?? "").trim() || null,
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (!user.profile.school_id) {
    return Response.json({ error: "No school linked to your profile." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: school } = await supabase.from("schools").select("id,province_id").eq("id", user.profile.school_id).single();

  const eventsQuery = supabase
    .from("events")
    .select("id,province_id,school_id,title,event_type,description,venue,starts_at,ends_at,capacity,status,provinces(name,code),schools(name)")
    .in("status", ["open", "published"])
    .order("starts_at", { ascending: true });

  if (school?.province_id) {
    eventsQuery.or(`province_id.is.null,province_id.eq.${school.province_id},school_id.eq.${user.profile.school_id}`);
  } else {
    eventsQuery.or(`province_id.is.null,school_id.eq.${user.profile.school_id}`);
  }

  const [eventsResult, bookingsResult] = await Promise.all([
    eventsQuery,
    supabase
      .from("event_bookings")
      .select("id,event_id,profile_id,school_id,attendee_name,attendee_email,attendee_phone,attendee_type,notes,status,created_at,events(title,starts_at),schools(name)")
      .eq("school_id", user.profile.school_id)
      .order("created_at", { ascending: false }),
  ]);

  if (eventsResult.error) return Response.json({ error: eventsResult.error.message }, { status: 400 });
  if (bookingsResult.error) return Response.json({ error: bookingsResult.error.message }, { status: 400 });

  const events = eventsResult.data.map((event) => ({
    ...event,
    booking_count: bookingsResult.data.filter((booking) => booking.event_id === event.id).length,
  }));

  return Response.json({ events, bookings: bookingsResult.data });
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  if (!["school_owner", "instructor"].includes(user.profile.role ?? "") || !user.profile.school_id) {
    return Response.json({ error: "Only linked school owners and instructors can add event attendees." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const booking = cleanBookingBody(body);

  if (!booking.event_id || !booking.attendee_name) {
    return Response.json({ error: "Event and attendee name are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!(await canAccessSchool(supabase, user, user.profile.school_id))) {
    return Response.json({ error: "You cannot add attendees for this school." }, { status: 403 });
  }

  const [{ data: school }, { data: selectedEvent, error: eventError }] = await Promise.all([
    supabase.from("schools").select("id,province_id").eq("id", user.profile.school_id).single(),
    supabase
      .from("events")
      .select("id,province_id,school_id,status,capacity")
      .eq("id", booking.event_id)
      .single(),
  ]);

  if (eventError || !selectedEvent) {
    return Response.json({ error: "Event not found." }, { status: 404 });
  }

  const visibleToSchool =
    !selectedEvent.school_id || selectedEvent.school_id === user.profile.school_id;
  const visibleToProvince =
    !selectedEvent.province_id || selectedEvent.province_id === school?.province_id;

  if (!["open", "published"].includes(selectedEvent.status) || !visibleToSchool || !visibleToProvince) {
    return Response.json({ error: "This event is not open for your school." }, { status: 403 });
  }

  if (selectedEvent.capacity != null) {
    const { count, error: countError } = await supabase
      .from("event_bookings")
      .select("id", { count: "exact", head: true })
      .eq("event_id", selectedEvent.id);

    if (countError) return Response.json({ error: countError.message }, { status: 400 });
    if ((count ?? 0) >= selectedEvent.capacity) {
      return Response.json({ error: "This event is already full." }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("event_bookings")
    .insert({
      ...booking,
      profile_id: user.id,
      school_id: user.profile.school_id,
      status: "booked",
    })
    .select("id,event_id,profile_id,school_id,attendee_name,attendee_email,attendee_phone,attendee_type,notes,status,created_at,events(title,starts_at),schools(name)")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ booking: data });
}
