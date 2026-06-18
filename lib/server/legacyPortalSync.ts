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

type LegacyCompetition = {
  id: string;
  name: string | null;
  comp_date: string | null;
  location: string | null;
  notes: string | null;
};

type LegacyEvent = {
  id: string;
  title: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  capacity: number | null;
  notes: string | null;
  status: string | null;
};

type LegacyCalendarPayload = {
  competitions?: LegacyCompetition[];
  events?: LegacyEvent[];
};

type SchoolRow = {
  id: string;
  name: string;
};

type LegacyEntry = {
  id: string;
  student_id: string;
  student_first_name: string | null;
  student_last_name: string | null;
  student_name: string | null;
  student_dob: string | null;
  student_belt_level: string | null;
  category: string | null;
  status: string | null;
};

type LegacyStudent = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  belt_rank: string | null;
  membership_status: string | null;
};

type LegacyInstructor = {
  id: string;
  student_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  rank: string | null;
  collar_level: string | null;
  active: boolean | null;
  notes: string | null;
};

type LegacyMembersPayload = {
  students?: LegacyStudent[];
  instructors?: LegacyInstructor[];
};

function legacyPortalUrl() {
  const baseUrl = process.env.LEGACY_PORTAL_URL || process.env.STUDENT_PORTAL_URL;
  if (!baseUrl) {
    throw new Error("LEGACY_PORTAL_URL is not configured.");
  }

  return baseUrl.replace(/\/$/, "");
}

function schoolPortalSyncUrl() {
  return `${legacyPortalUrl()}/api/integrations/organisation/sync`;
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

function splitLegacyName(entry: LegacyEntry) {
  const first = String(entry.student_first_name ?? "").trim();
  const last = String(entry.student_last_name ?? "").trim();

  if (first || last) {
    return {
      first_name: first || "Student",
      last_name: last || "",
    };
  }

  const parts = String(entry.student_name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || "Student",
    last_name: parts.slice(1).join(" ") || "Imported",
  };
}

function normalizeLegacyCategory(category: string | null) {
  const normalized = String(category ?? "").trim().toLowerCase();

  if (normalized === "form") return "Form";
  if (normalized === "weapon form" || normalized === "weapons form") return "Weapons Form";
  if (normalized === "point sparring" || normalized === "sparring") return "Sparring";
  if (normalized === "continuous sparring") return "Continuous Sparring";
  if (normalized.includes("escrima")) return "Escrima Sparring";
  if (normalized.includes("sword")) return "Sword Sparring";

  return category || null;
}

function normalizeMembershipStatus(status: string | null) {
  const normalized = String(status ?? "active").trim().toLowerCase();
  if (["active", "inactive", "pending"].includes(normalized)) return normalized;
  return normalized === "cancelled" ? "inactive" : "active";
}

function normalizeCollarLevel(collar: string | null) {
  const normalized = String(collar ?? "").trim();
  if (normalized === "Red") return "Red Collar";
  if (normalized === "Blue") return "Blue Collar";
  if (normalized === "Black") return "Black Collar";
  return normalized || null;
}

function normalizeTextForMatch(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function dateForMatch(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function tournamentNaturalKey(tournament: Pick<TournamentRow, "name" | "venue" | "starts_at">) {
  return [
    normalizeTextForMatch(tournament.name),
    normalizeTextForMatch(tournament.venue),
    dateForMatch(tournament.starts_at),
  ].join("|");
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

async function fetchLegacyMembers() {
  const response = await fetch(`${legacyPortalUrl()}/api/integrations/organisation/members`, {
    headers: {
      "x-integration-secret": integrationSecret(),
    },
  });

  const json = (await response.json().catch(() => null)) as LegacyMembersPayload | { error?: string } | null;

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Legacy members endpoint was not found. Redeploy the Legacy/student portal first.");
    }

    throw new Error(json && "error" in json ? json.error || "Legacy members fetch failed." : `Legacy members fetch failed (${response.status}).`);
  }

  return (json ?? {}) as LegacyMembersPayload;
}

async function fetchLegacyCalendar() {
  const response = await fetch(`${legacyPortalUrl()}/api/integrations/organisation/sync`, {
    headers: {
      "x-integration-secret": integrationSecret(),
    },
  });

  const json = (await response.json().catch(() => null)) as LegacyCalendarPayload | { error?: string } | null;

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Legacy calendar endpoint was not found. Redeploy the Legacy/student portal first.");
    }

    throw new Error(json && "error" in json ? json.error || "Legacy calendar fetch failed." : `Legacy calendar fetch failed (${response.status}).`);
  }

  return (json ?? {}) as LegacyCalendarPayload;
}

async function fetchLegacyCompetitionEntries(params: {
  externalCompetitionId?: string;
  legacyCompetitionId?: string;
}) {
  const url = new URL(`${legacyPortalUrl()}/api/integrations/organisation/competition-entries`);

  if (params.legacyCompetitionId) {
    url.searchParams.set("competition_id", params.legacyCompetitionId);
  } else if (params.externalCompetitionId) {
    url.searchParams.set("source", "nmaa-portal");
    url.searchParams.set("external_competition_id", params.externalCompetitionId);
  }

  const response = await fetch(url, {
    headers: {
      "x-integration-secret": integrationSecret(),
    },
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }

    throw new Error(json?.error || `Legacy entries fetch failed (${response.status}).`);
  }

  return (json?.entries ?? []) as LegacyEntry[];
}

async function upsertLegacyStudent(schoolId: string, student: LegacyStudent) {
  const { data, error } = await createSupabaseAdminClient()
    .from("students")
    .upsert(
      {
        school_id: schoolId,
        first_name: String(student.first_name ?? "").trim() || "Student",
        last_name: String(student.last_name ?? "").trim() || "Imported",
        date_of_birth: student.date_of_birth,
        belt_rank: student.belt_rank,
        membership_status: normalizeMembershipStatus(student.membership_status),
        external_source: "legacy-portal",
        external_student_id: student.id,
      },
      { onConflict: "external_source,external_student_id" }
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to sync student.");
  }

  return data.id as string;
}

async function legacySchoolId() {
  const configured = process.env.LEGACY_PORTAL_SCHOOL_ID || process.env.NMAA_LEGACY_SCHOOL_ID;
  if (configured) return configured;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("schools")
    .select("id, name")
    .ilike("name", "%Legacy%")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const school = data as SchoolRow | null;
  if (!school) {
    throw new Error("Legacy school was not found in NMAA. Set LEGACY_PORTAL_SCHOOL_ID in Vercel.");
  }

  return school.id;
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
  const uniqueTournaments = Array.from(
    new Map(tournaments.map((tournament) => [tournamentNaturalKey(tournament), tournament])).values()
  );

  return sendToLegacyPortal({
    source: "nmaa-portal",
    organization_name: "NMAA",
    competitions: uniqueTournaments.map((tournament) => ({
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

export async function importLegacyPortalTournamentEntries() {
  const supabase = createSupabaseAdminClient();
  const schoolId = await legacySchoolId();
  await importLegacyPortalCalendar();

  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select("id,name,venue,starts_at,ends_at,registration_closes_at,external_source,external_tournament_id")
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  let importedStudents = 0;
  let importedEntries = 0;
  let skippedEntries = 0;
  let skippedCompetitions = 0;
  const syncedAt = new Date().toISOString();

  for (const tournament of (tournaments ?? []) as Array<TournamentRow & { external_source?: string | null; external_tournament_id?: string | null }>) {
    const entries =
      tournament.external_source === "legacy-portal" && tournament.external_tournament_id
        ? await fetchLegacyCompetitionEntries({
            legacyCompetitionId: tournament.external_tournament_id,
          })
        : await fetchLegacyCompetitionEntries({
            externalCompetitionId: tournament.id,
          });

    if (entries === null) {
      skippedCompetitions += 1;
      continue;
    }

    for (const entry of entries) {
      if (!entry.id || !entry.student_id) {
        skippedEntries += 1;
        continue;
      }

      if (["declined", "rejected", "cancelled"].includes(entry.status ?? "")) {
        skippedEntries += 1;
        continue;
      }

      const names = splitLegacyName(entry);
      const { data: student, error: studentError } = await supabase
        .from("students")
        .upsert(
          {
            school_id: schoolId,
            first_name: names.first_name,
            last_name: names.last_name,
            date_of_birth: entry.student_dob,
            belt_rank: entry.student_belt_level,
            membership_status: "active",
            external_source: "legacy-portal",
            external_student_id: entry.student_id,
          },
          { onConflict: "external_source,external_student_id" }
        )
        .select("id")
        .single();

      if (studentError || !student) {
        skippedEntries += 1;
        continue;
      }

      importedStudents += 1;

      const { error: entryError } = await supabase.from("tournament_entries").upsert(
        {
          tournament_id: tournament.id,
          student_id: student.id,
          school_id: schoolId,
          category: normalizeLegacyCategory(entry.category),
          status: entry.status === "approved" ? "entered" : entry.status || "pending",
          external_source: "legacy-portal",
          external_entry_id: entry.id,
          external_synced_at: syncedAt,
          external_sync_error: null,
        },
        { onConflict: "external_source,external_entry_id" }
      );

      if (entryError) {
        skippedEntries += 1;
        continue;
      }

      importedEntries += 1;
    }
  }

  return {
    imported: {
      students: importedStudents,
      entries: importedEntries,
    },
    skipped: {
      entries: skippedEntries,
      competitions: skippedCompetitions,
    },
  };
}

export async function importLegacyPortalCalendar() {
  const supabase = createSupabaseAdminClient();
  const payload = await fetchLegacyCalendar();
  const syncedAt = new Date().toISOString();

  const competitions = payload.competitions ?? [];
  const events = payload.events ?? [];

  let importedTournaments = 0;
  let skippedTournaments = 0;

  const validCompetitions = competitions.filter(
    (competition) => competition.id && competition.name && competition.comp_date
  );

  const { data: existingTournamentRows, error: existingTournamentError } = await supabase
    .from("tournaments")
    .select("id,name,venue,starts_at,external_source,external_tournament_id");

  if (existingTournamentError) {
    throw new Error(existingTournamentError.message);
  }

  const existingTournaments = existingTournamentRows ?? [];

  for (const competition of validCompetitions) {
    const name = competition.name || "Legacy competition";
    const date = competition.comp_date || "";
    const venue = competition.location || null;

    const exactExternalMatch = existingTournaments.find(
      (tournament) =>
        tournament.external_source === "legacy-portal" &&
        tournament.external_tournament_id === competition.id
    );
    const naturalMatch = existingTournaments.find(
      (tournament) =>
        !tournament.external_tournament_id &&
        normalizeTextForMatch(tournament.name) === normalizeTextForMatch(name) &&
        dateForMatch(tournament.starts_at) === dateForMatch(date) &&
        normalizeTextForMatch(tournament.venue) === normalizeTextForMatch(venue)
    );

    const matchedId = exactExternalMatch?.id ?? naturalMatch?.id ?? null;
    const row = {
      name,
      venue,
      starts_at: date,
      ends_at: null,
      registration_closes_at: null,
      external_source: "legacy-portal",
      external_tournament_id: competition.id,
      external_synced_at: syncedAt,
    };

    const result = matchedId
      ? await supabase.from("tournaments").update(row).eq("id", matchedId)
      : await supabase.from("tournaments").insert(row);

    if (result.error) {
      skippedTournaments += 1;
      continue;
    }

    importedTournaments += 1;
  }

  const eventRows = events
    .filter((event) => event.id && event.title && event.event_date)
    .map((event) => ({
      title: event.title || "Legacy event",
      event_type: "legacy",
      description: event.notes,
      venue: event.location,
      starts_at: event.start_time ? `${event.event_date}T${event.start_time}` : event.event_date,
      ends_at: event.end_time ? `${event.event_date}T${event.end_time}` : null,
      capacity: event.capacity,
      status: event.status === "cancelled" ? "cancelled" : "open",
      external_source: "legacy-portal",
      external_event_id: event.id,
      external_synced_at: syncedAt,
    }));

  if (eventRows.length > 0) {
    const { error } = await supabase
      .from("events")
      .upsert(eventRows, { onConflict: "external_source,external_event_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    imported: {
      tournaments: importedTournaments,
      events: eventRows.length,
    },
    skipped: {
      tournaments: competitions.length - validCompetitions.length + skippedTournaments,
      events: events.length - eventRows.length,
    },
  };
}

export async function importLegacyPortalMembers() {
  const supabase = createSupabaseAdminClient();
  const schoolId = await legacySchoolId();
  const payload = await fetchLegacyMembers();
  const syncedAt = new Date().toISOString();

  let importedStudents = 0;
  let importedInstructors = 0;
  let skippedStudents = 0;
  let skippedInstructors = 0;
  const errors: string[] = [];
  const studentIdMap = new Map<string, string>();

  for (const student of payload.students ?? []) {
    if (!student.id) {
      skippedStudents += 1;
      if (errors.length < 5) errors.push("Student skipped: missing Legacy student ID.");
      continue;
    }

    try {
      const nmaaStudentId = await upsertLegacyStudent(schoolId, student);
      studentIdMap.set(student.id, nmaaStudentId);
      importedStudents += 1;
    } catch (error) {
      skippedStudents += 1;
      if (errors.length < 5) {
        const name = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || student.id;
        errors.push(
          `Student skipped (${name}): ${
            error instanceof Error ? error.message : "Unknown database error."
          }`
        );
      }
    }
  }

  for (const instructor of payload.instructors ?? []) {
    if (!instructor.id) {
      skippedInstructors += 1;
      if (errors.length < 5) errors.push("Instructor skipped: missing Legacy instructor ID.");
      continue;
    }

    const { data: existingStudent, error: studentLookupError } = await supabase
      .from("students")
      .select("id")
      .eq("external_source", "legacy-portal")
      .eq("external_student_id", instructor.student_id)
      .maybeSingle();

    if (studentLookupError) {
      skippedInstructors += 1;
      if (errors.length < 5) {
        errors.push(
          `Instructor skipped (${instructor.full_name ?? instructor.id}): ${
            studentLookupError.message
          }`
        );
      }
      continue;
    }

    const nmaaStudentId = studentIdMap.get(instructor.student_id) || existingStudent?.id || null;

    const { error } = await supabase.from("instructors").upsert(
      {
        school_id: schoolId,
        full_name: String(instructor.full_name ?? "").trim() || "Imported Instructor",
        email: instructor.email,
        phone: instructor.phone,
        rank: instructor.rank,
        collar_level: normalizeCollarLevel(instructor.collar_level),
        training_status: "active",
        active: instructor.active !== false,
        external_source: "legacy-portal",
        external_instructor_id: instructor.id,
        external_student_id: instructor.student_id,
        external_synced_at: syncedAt,
        student_id: nmaaStudentId,
      },
      { onConflict: "external_source,external_instructor_id" }
    );

    if (error) {
      const fallback = await supabase.from("instructors").upsert(
        {
          school_id: schoolId,
          full_name: String(instructor.full_name ?? "").trim() || "Imported Instructor",
          email: instructor.email,
          phone: instructor.phone,
          rank: instructor.rank,
          collar_level: normalizeCollarLevel(instructor.collar_level),
          training_status: "active",
          active: instructor.active !== false,
          external_source: "legacy-portal",
          external_instructor_id: instructor.id,
          external_student_id: instructor.student_id,
          external_synced_at: syncedAt,
        },
        { onConflict: "external_source,external_instructor_id" }
      );

      if (fallback.error) {
        skippedInstructors += 1;
        if (errors.length < 5) {
          errors.push(
            `Instructor skipped (${instructor.full_name ?? instructor.id}): ${
              fallback.error.message
            }`
          );
        }
        continue;
      }
    }

    importedInstructors += 1;
  }

  return {
    imported: {
      students: importedStudents,
      instructors: importedInstructors,
    },
    skipped: {
      students: skippedStudents,
      instructors: skippedInstructors,
    },
    errors,
  };
}
