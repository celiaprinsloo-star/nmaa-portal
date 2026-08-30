import { requireAdmin } from "@/lib/server/requireAdmin";
import { logAuditEvent } from "@/lib/server/audit";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const allowedStatuses = new Set(["outstanding", "paid"]);

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const body = await request.json().catch(() => null);
  const tournamentId = String(body?.tournament_id ?? "").trim();
  const schoolId = String(body?.school_id ?? "").trim();
  const status = String(body?.status ?? "paid").trim();
  const amountZar = Math.max(0, Number(body?.amount_zar) || 0);

  if (!tournamentId || !schoolId) {
    return Response.json({ error: "Tournament and school are required." }, { status: 400 });
  }

  if (!allowedStatuses.has(status)) {
    return Response.json({ error: "Choose a valid payment status." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const paidAt = status === "paid" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("tournament_school_fee_payments")
    .upsert(
      {
        tournament_id: tournamentId,
        school_id: schoolId,
        status,
        amount_zar: amountZar,
        paid_at: paidAt,
        marked_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tournament_id,school_id" },
    )
    .select("id,tournament_id,school_id,status,amount_zar,paid_at,marked_by")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "tournament_school_fee.payment_status_changed",
    entityTable: "tournament_school_fee_payments",
    entityId: data.id,
    summary: `Tournament school fee marked ${status}`,
    metadata: { tournament_id: tournamentId, school_id: schoolId, amount_zar: amountZar, status },
  });

  return Response.json({ payment: data });
}
