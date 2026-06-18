import { messageToHtml, sendPortalEmail } from "@/lib/server/email";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ReminderDocument = {
  id: string;
  school_id: string | null;
  document_name: string;
  status: string;
  expires_at: string | null;
  compliance_requirements: { name?: string | null } | { name?: string | null }[] | null;
  schools: { name?: string | null; contact_email?: string | null } | { name?: string | null; contact_email?: string | null }[] | null;
  instructors: { full_name?: string | null } | { full_name?: string | null }[] | null;
};

function relatedOne<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildReminderMessage(schoolName: string, documents: ReminderDocument[]) {
  const lines = documents.map((document) => {
    const requirement = relatedOne(document.compliance_requirements)?.name ?? document.document_name;
    const instructor = relatedOne(document.instructors)?.full_name;
    const owner = instructor ? ` for ${instructor}` : "";
    return `- ${requirement}${owner}: expires ${document.expires_at}`;
  });

  return [
    `Good day ${schoolName},`,
    "",
    "The following compliance document(s) are expiring within the next month:",
    "",
    ...lines,
    "",
    "Please log in to the NMAA SA Portal and upload updated documents where needed.",
    "",
    "NMAA SA",
  ].join("\n");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Not authorised." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const today = new Date();
  const reminderWindowEnd = addDays(today, 30);
  const reminderType = "one_month_expiry";

  const { data: alreadyReminded, error: remindersError } = await supabase
    .from("compliance_reminder_logs")
    .select("document_id")
    .eq("reminder_type", reminderType);

  if (remindersError) {
    return Response.json({ error: remindersError.message }, { status: 400 });
  }

  const remindedIds = new Set((alreadyReminded ?? []).map((item) => item.document_id));

  const { data, error } = await supabase
    .from("compliance_documents")
    .select("id,school_id,document_name,status,expires_at,compliance_requirements(name),schools(name,contact_email),instructors(full_name)")
    .in("status", ["submitted", "approved"])
    .gte("expires_at", dateOnly(today))
    .lte("expires_at", dateOnly(reminderWindowEnd))
    .order("expires_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const documents = (data as ReminderDocument[]).filter((document) => !remindedIds.has(document.id));
  const grouped = documents.reduce<Record<string, ReminderDocument[]>>((groups, document) => {
    const school = relatedOne(document.schools);
    const email = school?.contact_email?.trim().toLowerCase();
    if (!email) return groups;
    groups[email] = [...(groups[email] ?? []), document];
    return groups;
  }, {});

  let sentCount = 0;
  let documentCount = 0;

  for (const [email, schoolDocuments] of Object.entries(grouped)) {
    const schoolName = relatedOne(schoolDocuments[0].schools)?.name ?? "School";
    const message = buildReminderMessage(schoolName, schoolDocuments);
    const { result, error: sendError } = await sendPortalEmail({
      bcc: [email],
      replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || email,
      subject: "Compliance documents expiring soon",
      text: message,
      html: messageToHtml(message),
    });

    if (sendError) {
      return Response.json({ error: sendError }, { status: sendError.includes("configured") ? 500 : 400 });
    }

    const logRows = schoolDocuments.map((document) => ({
      document_id: document.id,
      school_id: document.school_id,
      reminder_type: reminderType,
      recipient_email: email,
      provider_message_id: result?.messageId ?? null,
    }));
    const { error: logError } = await supabase.from("compliance_reminder_logs").insert(logRows);

    if (logError) {
      return Response.json({ error: logError.message }, { status: 400 });
    }

    sentCount += 1;
    documentCount += schoolDocuments.length;
  }

  return Response.json({ ok: true, emails_sent: sentCount, documents_reminded: documentCount });
}
