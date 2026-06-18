import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type TournamentRow = {
  id: string;
  name: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  registration_closes_at: string | null;
};

type EventRow = {
  id: string;
  title: string;
  event_type: string | null;
  description: string | null;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  status: string | null;
};

function schoolPortalSyncUrl() {
  const baseUrl = process.env.LEGACY_PORTAL_URL || process.env.STUDENT_PORTAL_URL;
  if (!baseUrl) {
    throw new Error("LEGACY_PORTAL_URL is not configured.");
  }

  return `${baseUrl.replace(/\/$/, "")}/api/integrations/organisation/sync`;
}

function integrationSecret() {
  const secret =
    process.env.ORGANISATION_INTEGRATION_SECRET ||
    process.env.ORGANIZATION_INTEGRATION_SECRET;

  if (!secret) {
    throw new Error("ORGANISATION_INTEGRATION_SECRET is not configured.");
  }

  return secret;
}

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function timeOnly(value: string | null) {
  if (!value) return null;
  const time = value.includes("T") ? value.split("T")[1] : value;
  return time.slice(0, 5);
}

function eventStatus(status: string | null) {
  if (status === "cancelled") return "cancelled";
  if (status === "closed") return "closed";
  return "published";
}

async function sendToLegacyPortal(payload: unknown) {
  const response = await fetch(schoolPortalSyncUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-integration-secret": integrationSecret(),
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || `Legacy portal sync failed (${response.status}).`);
  }

  return json;
}

export async function syncLegacyPortalCalendar() {
  const supabase = createSupabaseAdminClient();

  const [tournamentsResult, eventsResult] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id,name,venue,starts_at,ends_at,registration_closes_at")
      .order("starts_at", { ascending: true }),
    supabase
      .from("events")
      .select("id,title,event_type,description,venue,starts_at,ends_at,capacity,status")
      .order("starts_at", { ascending: true }),
  ]);

  if (tournamentsResult.error) {
    throw new Error(tournamentsResult.error.message);
  }

  if (eventsResult.error) {
    throw new Error(eventsResult.error.message);
  }

  const tournaments = (tournamentsResult.data ?? []) as TournamentRow[];
  const events = (eventsResult.data ?? []) as EventRow[];

  return sendToLegacyPortal({
    source: "nmaa-portal",
    organization_name: "NMAA",
    competitions: tournaments.map((tournament) => ({
      external_id: tournament.id,
      name: tournament.name,
      comp_date: dateOnly(tournament.starts_at),
      location: tournament.venue,
      notes: tournament.registration_closes_at
        ? `Registration closes ${dateOnly(tournament.registration_closes_at)}`
        : null,
    })),
    events: events.map((event) => ({
      external_id: event.id,
      title: event.title,
      event_date: dateOnly(event.starts_at),
      start_time: timeOnly(event.starts_at),
      end_time: timeOnly(event.ends_at),
      location: event.venue,
      capacity: event.capacity,
      notes: [event.event_type, event.description].filter(Boolean).join("\n\n") || null,
      status: eventStatus(event.status),
    })),
  });
}
