import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type EntryRouteContext = {
  params: Promise<{ id: string }>;
};

function cleanEntryBody(body: Record<string, unknown> | null) {
  return {
    tournament_id: String(body?.tournament_id ?? "").trim(),
    student_id: String(body?.student_id ?? "").trim(),
    school_id: String(body?.school_id ?? "").trim(),
    category: String(body?.category ?? "").trim() || null,
    placement: body?.placement ? Number(body.placement) : null,
    result_label: String(body?.result_label ?? "").trim() || null,
    medal: String(body?.medal ?? "").trim() || null,
    points: body?.points ? Number(body.points) : null,
    status: String(body?.status ?? "entered").trim() || "entered",
  };
}

export async function PATCH(request: Request, context: EntryRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const entry = cleanEntryBody(body);

  if (!entry.tournament_id || !entry.student_id || !entry.school_id) {
    return Response.json({ error: "Tournament and student are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tournament_entries")
    .update(entry)
    .eq("id", id)
    .select("id,tournament_id,student_id,school_id,category,placement,result_label,medal,points,status,students(first_name,last_name,belt_rank),schools(name),tournaments(name)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ entry: data });
}

export async function DELETE(request: Request, context: EntryRouteContext) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("tournament_entries").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
