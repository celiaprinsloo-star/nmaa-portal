import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type AuditLogInput = {
  actorId: string | null;
  action: string;
  entityTable: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent({
  actorId,
  action,
  entityTable,
  entityId = null,
  summary = null,
  metadata = {},
}: AuditLogInput) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("audit_logs").insert({
    actor_profile_id: actorId,
    action,
    entity_table: entityTable,
    entity_id: entityId,
    summary,
    metadata,
  });
}
