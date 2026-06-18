import { canAccessSchool, requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function cleanBookingBody(body: Record<string, unknown> | null) {
  return {
    event_id: String(body?.event_id ?? "").trim(),
    student_id: String(body?.student_id ?? "").trim() || null,
    instructor_id: String(body?.instructor_id ?? "").trim() || null,
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
      .select("id,event_id,profile_id,school_id,student_id,instructor_id,attendee_name,attendee_email,attendee_phone,attendee_type,notes,status,created_at,events(title,starts_at),schools(name),students(first_name,last_name),instructors(full_name)")
      .eq("school_id", user.profile.school_id)
      .order("created_at", { ascending: false }),
  ]);
  const [studentsResult, instructorsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id,school_id,first_name,last_name,belt_rank")
      .eq("school_id", user.profile.school_id)
      .eq("membership_status", "active")
      .order("last_name"),
    supabase
      .from("instructors")
      .select("id,school_id,full_name,email,phone")
      .eq("school_id", user.profile.school_id)
      .eq("active", true)
      .order("full_name"),
  ]);

  if (eventsResult.error) return Response.json({ error: eventsResult.error.message }, { status: 400 });
  if (bookingsResult.error) return Response.json({ error: bookingsResult.error.message }, { status: 400 });
  if (studentsResult.error) return Response.json({ error: studentsResult.error.message }, { status: 400 });
  if (instructorsResult.error) return Response.json({ error: instructorsResult.error.message }, { status: 400 });

  const events = eventsResult.data.map((event) => ({
    ...event,
    booking_count: bookingsResult.data.filter((booking) => booking.event_id === event.id).length,
  }));

  return Response.json({
    events,
    bookings: bookingsResult.data,
    students: studentsResult.data,
    instructors: instructorsResult.data,
    can_create_events: user.profile.role === "school_owner",
  });
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

  if (booking.student_id) {
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("id", booking.student_id)
      .eq("school_id", user.profile.school_id)
      .maybeSingle();
    if (!student) return Response.json({ error: "Selected student is not in your school." }, { status: 403 });
  }

  if (booking.instructor_id) {
    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("id", booking.instructor_id)
      .eq("school_id", user.profile.school_id)
      .maybeSingle();
    if (!instructor) return Response.json({ error: "Selected instructor is not in your school." }, { status: 403 });
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
    .select("id,event_id,profile_id,school_id,student_id,instructor_id,attendee_name,attendee_email,attendee_phone,attendee_type,notes,status,created_at,events(title,starts_at),schools(name),students(first_name,last_name),instructors(full_name)")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ booking: data });
}
