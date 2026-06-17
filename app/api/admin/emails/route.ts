import { requireAdmin } from "@/lib/server/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const resendEndpoint = "https://api.resend.com/emails";

function cleanEmailBody(body: Record<string, unknown> | null) {
  return {
    subject: String(body?.subject ?? "").trim(),
    message: String(body?.message ?? "").trim(),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function messageToHtml(message: string) {
  return escapeHtml(message)
    .split(/\r?\n/)
    .map((line) => (line ? `<p>${line}</p>` : "<br />"))
    .join("");
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) return response;

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO || user.email;

  if (!resendApiKey || !fromEmail) {
    return Response.json(
      { error: "Email sending is not configured yet. Add RESEND_API_KEY and EMAIL_FROM in Vercel." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = cleanEmailBody(body);

  if (!email.subject || !email.message) {
    return Response.json({ error: "Subject and message are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: schools, error: schoolsError } = await supabase
    .from("schools")
    .select("id,name,contact_email")
    .not("contact_email", "is", null)
    .order("name");

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

  const sendResponse = await fetch(resendEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [fromEmail],
      bcc: recipients,
      reply_to: replyTo,
      subject: email.subject,
      text: email.message,
      html: messageToHtml(email.message),
    }),
  });
  const sendPayload = await sendResponse.json().catch(() => null);

  if (!sendResponse.ok) {
    return Response.json(
      { error: sendPayload?.message ?? "Email provider rejected the message." },
      { status: 400 },
    );
  }

  await supabase.from("email_logs").insert({
    subject: email.subject,
    message: email.message,
    recipient_count: recipients.length,
    provider_message_id: sendPayload?.id ?? null,
    sent_by: user.id,
  });

  return Response.json({
    ok: true,
    recipient_count: recipients.length,
    provider_message_id: sendPayload?.id ?? null,
  });
}
