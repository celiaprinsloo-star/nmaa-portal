import { requireAdmin } from "@/lib/server/requireAdmin";
import { messageToHtml, sendPortalEmail } from "@/lib/server/email";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function cleanEmailBody(body: Record<string, unknown> | null) {
  return {
    subject: String(body?.subject ?? "").trim(),
    message: String(body?.message ?? "").trim(),
    school_ids: Array.isArray(body?.school_ids)
      ? body.school_ids.map((id) => String(id).trim()).filter(Boolean)
      : [],
  };
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const replyTo = process.env.EMAIL_REPLY_TO || user.email;

  const body = await request.json().catch(() => null);
  const email = cleanEmailBody(body);

  if (!email.subject || !email.message) {
    return Response.json({ error: "Subject and message are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const schoolsQuery = supabase
    .from("schools")
    .select("id,name,contact_email")
    .not("contact_email", "is", null)
    .order("name");

  if (email.school_ids.length > 0) {
    schoolsQuery.in("id", email.school_ids);
  }

  const { data: schools, error: schoolsError } = await schoolsQuery;

  if (schoolsError) {
    return Response.json({ error: schoolsError.message }, { status: 400 });
  }

  const recipients = Array.from(
    new Set(
      schools
        .map((school) => school.contact_email?.trim().toLowerCase())
        .filter((emailAddress): emailAddress is string => Boolean(emailAddress)),
    ),
  );

  if (recipients.length === 0) {
    return Response.json({ error: "No school contact emails are recorded yet." }, { status: 400 });
  }

  const { result, error: sendError } = await sendPortalEmail({
    bcc: recipients,
    replyTo,
    subject: email.subject,
    text: email.message,
    html: messageToHtml(email.message),
  });

  if (sendError) {
    return Response.json({ error: sendError }, { status: sendError.includes("configured") ? 500 : 400 });
  }

  await supabase.from("email_logs").insert({
    subject: email.subject,
    message: email.message,
    recipient_count: recipients.length,
    provider_message_id: result?.messageId ?? null,
    sent_by: user.id,
  });

  return Response.json({
    ok: true,
    recipient_count: recipients.length,
    provider_message_id: result?.messageId ?? null,
  });
}
