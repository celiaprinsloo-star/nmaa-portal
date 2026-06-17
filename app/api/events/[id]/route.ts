import { canAccessSchool, requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type BookingRouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: BookingRouteContext) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) return response;

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("event_bookings").select("school_id").eq("id", id).single();

  if (!existing?.school_id || !(await canAccessSchool(supabase, user, existing.school_id))) {
    return Response.json({ error: "Booking not found." }, { status: 404 });
  }

  const { error } = await supabase.from("event_bookings").delete().eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
