import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type EventRouteContext = {
  params: Promise<{ id: string }>;
};

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
    updated_at: new Date().toISOString(),
  };
}

export async function PATCH(request: Request, context: EventRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const event = cleanEventBody(body);

  if (!event.title || !event.starts_at) {
    return Response.json({ error: "Event title and start date/time are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("events").update(event).eq("id", id).select(eventSelect).single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ event: data });
}

export async function DELETE(request: Request, context: EventRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
