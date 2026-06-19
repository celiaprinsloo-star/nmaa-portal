"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import BrandMark from "@/app/components/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { tournamentCategories, tournamentPointsForResult, tournamentResults } from "@/lib/tournamentRules";
import type { Province, Student, Tournament, TournamentEntry } from "@/lib/types";

const emptyTournament = {
  province_id: "",
  name: "",
  venue: "",
  starts_at: "",
  ends_at: "",
  registration_closes_at: "",
};

const emptyEntry = {
  tournament_id: "",
  student_id: "",
  school_id: "",
  category: "",
  result_label: "",
  medal: "participation",
  status: "entered",
};

type StudentOption = Pick<Student, "id" | "school_id" | "first_name" | "last_name" | "belt_rank"> & {
  schools?: { name: string } | null;
};

type LeaderboardRow = {
  school_id: string;
  school_name: string;
  points: number;
  gold: number;
  silver: number;
  bronze: number;
  results: number;
  entries: number;
};

export default function TournamentsClient() {
  const [token, setToken] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [tournamentForm, setTournamentForm] = useState(emptyTournament);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [editingTournamentId, setEditingTournamentId] = useState("");
  const [editingEntryId, setEditingEntryId] = useState("");
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadTournaments(activeToken: string) {
    const response = await fetch("/api/admin/tournaments", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to load tournaments.");
      return;
    }

    setTournaments(payload.tournaments);
    setEntries(payload.entries);
    setProvinces(payload.provinces);
    setStudents(payload.students);
    setLeaderboard(payload.leaderboard ?? []);
    setTournamentForm((current) => ({
      ...current,
      province_id: current.province_id || payload.provinces[0]?.id || "",
    }));
    setEntryForm((current) => ({
      ...current,
      tournament_id: current.tournament_id || payload.tournaments[0]?.id || "",
      student_id: current.student_id || payload.students[0]?.id || "",
      school_id: current.school_id || payload.students[0]?.school_id || "",
    }));
    setError("");
  }

  useEffect(() => {
    async function loadSession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const activeToken = data.session?.access_token;

      if (!activeToken) {
        window.location.href = "/login?next=/admin/tournaments";
        return;
      }

      setToken(activeToken);
      await loadTournaments(activeToken);
    }

    loadSession();
  }, []);

  function updateTournamentField(field: keyof typeof emptyTournament, value: string) {
    setTournamentForm((current) => ({ ...current, [field]: value }));
  }

  function updateEntryField(field: keyof typeof emptyEntry, value: string) {
    if (field === "student_id") {
      const selectedStudent = students.find((student) => student.id === value);
      setEntryForm((current) => ({
        ...current,
        student_id: value,
        school_id: selectedStudent?.school_id || "",
      }));
      return;
    }

    setEntryForm((current) => ({ ...current, [field]: value }));
  }

  function resetTournamentForm() {
    setEditingTournamentId("");
    setTournamentForm({ ...emptyTournament, province_id: provinces[0]?.id || "" });
  }

  function resetEntryForm() {
    setEditingEntryId("");
    setEntryForm({
      ...emptyEntry,
      tournament_id: tournaments[0]?.id || "",
      student_id: students[0]?.id || "",
      school_id: students[0]?.school_id || "",
    });
  }

  function editTournament(tournament: Tournament) {
    setEditingTournamentId(tournament.id);
    setTournamentForm({
      province_id: tournament.province_id ?? "",
      name: tournament.name,
      venue: tournament.venue ?? "",
      starts_at: tournament.starts_at.slice(0, 16),
      ends_at: tournament.ends_at?.slice(0, 16) ?? "",
      registration_closes_at: tournament.registration_closes_at?.slice(0, 16) ?? "",
    });
  }

function editEntry(entry: TournamentEntry) {
    setEditingEntryId(entry.id);
    setEntryForm({
      tournament_id: entry.tournament_id,
      student_id: entry.student_id,
      school_id: entry.school_id,
      category: entry.category ?? "",
      result_label: entry.result_label ?? "",
      medal: entry.medal ?? "participation",
      status: entry.status,
    });
  }

  function formatTournamentDate(value: string) {
    return new Date(value).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const tournamentGroups = tournaments.map((tournament) => {
    const tournamentEntries = entries.filter((entry) => entry.tournament_id === tournament.id);
    const points = tournamentEntries.reduce((total, entry) => total + Number(entry.points ?? 0), 0);

    return {
      tournament,
      entries: tournamentEntries,
      points,
      results: tournamentEntries.filter((entry) => entry.medal || entry.result_label).length,
    };
  });

  async function saveTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(
      editingTournamentId ? `/api/admin/tournaments/${editingTournamentId}` : "/api/admin/tournaments",
      {
        method: editingTournamentId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tournamentForm),
      },
    );
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save tournament.");
      return;
    }

    resetTournamentForm();
    await loadTournaments(token);
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch(
      editingEntryId ? `/api/admin/tournament-entries/${editingEntryId}` : "/api/admin/tournament-entries",
      {
        method: editingEntryId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entryForm),
      },
    );
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save tournament entry.");
      return;
    }

    resetEntryForm();
    await loadTournaments(token);
  }

  async function deleteTournament(id: string) {
    setBusy(true);
    const response = await fetch(`/api/admin/tournaments/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete tournament.");
      return;
    }

    await loadTournaments(token);
  }

  async function deleteEntry(id: string) {
    setBusy(true);
    const response = await fetch(`/api/admin/tournament-entries/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete tournament entry.");
      return;
    }

    await loadTournaments(token);
  }

  async function syncLegacyPortal() {
    setBusy(true);
    setError("");
    setSyncMessage("");

    const response = await fetch("/api/admin/legacy-portal-sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to sync Legacy portal.");
      return;
    }

    const imported = payload.result?.imported;
    setSyncMessage(
      `Legacy portal synced: ${imported?.competitions ?? 0} tournaments and ${
        imported?.events ?? 0
      } events.`
    );
  }

  async function importLegacyEntries() {
    setBusy(true);
    setError("");
    setSyncMessage("");

    const response = await fetch("/api/admin/legacy-portal-sync/entries", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to import Legacy entries.");
      return;
    }

    const imported = payload.result?.imported;
    const skipped = payload.result?.skipped;
    setSyncMessage(
      `Legacy entries imported: ${imported?.entries ?? 0} entries and ${
        imported?.students ?? 0
      } student records. Skipped ${skipped?.entries ?? 0} entries and ${
        skipped?.competitions ?? 0
      } tournaments.`
    );
    await loadTournaments(token);
  }

  async function importLegacyTournaments() {
    setBusy(true);
    setError("");
    setSyncMessage("");

    const response = await fetch("/api/admin/legacy-portal-sync/calendar", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to import Legacy tournaments.");
      return;
    }

    const imported = payload.result?.imported;
    const skipped = payload.result?.skipped;
    setSyncMessage(
      `Legacy calendar imported: ${imported?.tournaments ?? 0} tournaments and ${
        imported?.events ?? 0
      } events. Skipped ${skipped?.tournaments ?? 0} tournaments and ${
        skipped?.events ?? 0
      } events.`
    );
    await loadTournaments(token);
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>Tournaments</h1>
          <p className="muted">Create tournaments, enter students, and record results.</p>
        </div>
        <div className="row-actions">
          <button className="secondary-button compact" disabled={busy || !token} onClick={syncLegacyPortal} type="button">
            Sync Legacy Portal
          </button>
          <button className="secondary-button compact" disabled={busy || !token} onClick={importLegacyTournaments} type="button">
            Import Legacy Tournaments
          </button>
          <button className="secondary-button compact" disabled={busy || !token} onClick={importLegacyEntries} type="button">
            Import Legacy Entries
          </button>
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}
      {syncMessage ? <section className="content-shell"><p className="form-success">{syncMessage}</p></section> : null}

      <section className="section-title">
        <h2>School leaderboard</h2>
        <p>Ranked by points, then medals.</p>
      </section>
      <section className="content-shell table-list">
        {leaderboard.length === 0 ? (
          <article className="empty-state">No tournament results recorded yet.</article>
        ) : (
          leaderboard.map((row, index) => (
            <article className="list-row" key={row.school_id}>
              <div>
                <h2>{index + 1}. {row.school_name}</h2>
                <dl className="detail-grid">
                  <div><dt>Points</dt><dd>{row.points}</dd></div>
                  <div><dt>Gold</dt><dd>{row.gold}</dd></div>
                  <div><dt>Silver</dt><dd>{row.silver}</dd></div>
                  <div><dt>Bronze</dt><dd>{row.bronze}</dd></div>
                  <div><dt>Entries</dt><dd>{row.entries}</dd></div>
                </dl>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="two-column-workspace">
        <form className="admin-form" onSubmit={saveTournament}>
          <h2>{editingTournamentId ? "Edit tournament" : "Add tournament"}</h2>
          <label>
            Name
            <input value={tournamentForm.name} onChange={(event) => updateTournamentField("name", event.target.value)} required />
          </label>
          <label>
            Province
            <select value={tournamentForm.province_id} onChange={(event) => updateTournamentField("province_id", event.target.value)}>
              <option value="">National</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>{province.name}</option>
              ))}
            </select>
          </label>
          <label>
            Venue
            <input value={tournamentForm.venue} onChange={(event) => updateTournamentField("venue", event.target.value)} />
          </label>
          <label>
            Start
            <input type="datetime-local" value={tournamentForm.starts_at} onChange={(event) => updateTournamentField("starts_at", event.target.value)} required />
          </label>
          <label>
            End
            <input type="datetime-local" value={tournamentForm.ends_at} onChange={(event) => updateTournamentField("ends_at", event.target.value)} />
          </label>
          <button className="primary-button compact" disabled={busy} type="submit">
            {editingTournamentId ? "Save tournament" : "Add tournament"}
          </button>
        </form>

        <form className="admin-form" onSubmit={saveEntry}>
          <h2>{editingEntryId ? "Edit result" : "Add entry / result"}</h2>
          <label>
            Tournament
            <select value={entryForm.tournament_id} onChange={(event) => updateEntryField("tournament_id", event.target.value)} required>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>{tournament.name}</option>
              ))}
            </select>
          </label>
          <label>
            Student
            <select value={entryForm.student_id} onChange={(event) => updateEntryField("student_id", event.target.value)} required>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.first_name} {student.last_name} - {student.schools?.name ?? "No school"}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={entryForm.category} onChange={(event) => updateEntryField("category", event.target.value)} required>
              <option value="">Select category</option>
              {tournamentCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Result
            <select value={entryForm.medal} onChange={(event) => updateEntryField("medal", event.target.value)}>
              {tournamentResults.map((result) => (
                <option key={result} value={result}>{result}</option>
              ))}
            </select>
          </label>
          <p className="small-note">Points will be calculated automatically: {tournamentPointsForResult(entryForm.medal) ?? 0} points.</p>
          <label>
            Result note
            <input value={entryForm.result_label} onChange={(event) => updateEntryField("result_label", event.target.value)} />
          </label>
          <button className="primary-button compact" disabled={busy || tournaments.length === 0 || students.length === 0} type="submit">
            {editingEntryId ? "Save result" : "Add entry"}
          </button>
        </form>
      </section>

      <section className="section-title">
        <h2>Tournament register</h2>
        <p>Quick overview of all tournaments and their imported results.</p>
      </section>
      <section className="tournament-card-grid">
        {tournamentGroups.map(({ tournament, entries: tournamentEntries, points, results }) => (
          <article className="tournament-card" key={tournament.id}>
            <div className="tournament-card-header">
              <div>
                <h2>{tournament.name}</h2>
                <p>{tournament.venue ?? "No venue"} | {formatTournamentDate(tournament.starts_at)}</p>
              </div>
              <span className="status-pill">{tournament.provinces?.name ?? "National"}</span>
            </div>
            <dl className="tournament-mini-grid">
              <div><dt>Entries</dt><dd>{tournamentEntries.length}</dd></div>
              <div><dt>Results</dt><dd>{results}</dd></div>
              <div><dt>Points</dt><dd>{points}</dd></div>
            </dl>
            <div className="row-actions">
              <button className="secondary-button compact" onClick={() => editTournament(tournament)} type="button">Edit</button>
              <button className="danger-button compact" disabled={busy} onClick={() => deleteTournament(tournament.id)} type="button">Delete</button>
            </div>
          </article>
        ))}
      </section>

      <section className="section-title">
        <h2>Results by tournament</h2>
        <p>Open a tournament to manage its students, categories, results, and points.</p>
      </section>
      <section className="tournament-accordion-list">
        {tournamentGroups.length === 0 ? (
          <article className="empty-state">No tournaments recorded yet.</article>
        ) : (
          tournamentGroups.map(({ tournament, entries: tournamentEntries, points }, index) => (
            <details className="tournament-group" key={tournament.id} open={index === 0}>
              <summary>
                <span>
                  <strong>{tournament.name}</strong>
                  <small>{formatTournamentDate(tournament.starts_at)} | {tournament.venue ?? "No venue"}</small>
                </span>
                <span className="tournament-summary-counts">
                  <b>{tournamentEntries.length}</b> entries
                  <b>{points}</b> points
                </span>
              </summary>
              {tournamentEntries.length === 0 ? (
                <article className="empty-state">No results imported for this tournament yet.</article>
              ) : (
                <div className="responsive-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>School</th>
                        <th>Category</th>
                        <th>Result</th>
                        <th>Points</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournamentEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.students?.first_name} {entry.students?.last_name}</td>
                          <td>{entry.schools?.name ?? "No school"}</td>
                          <td>{entry.category ?? "No category"}</td>
                          <td>{entry.result_label || entry.medal || "Entered"}</td>
                          <td>{entry.points ?? 0}</td>
                          <td>
                            <div className="row-actions">
                              <button className="secondary-button compact" onClick={() => editEntry(entry)} type="button">Edit</button>
                              <button className="danger-button compact" disabled={busy} onClick={() => deleteEntry(entry.id)} type="button">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          ))
        )}
      </section>
    </main>
  );
}
