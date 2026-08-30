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
  age_calculation_basis: "competition_date",
};

const emptyFeeStructure = {
  base_fee: "",
  included_events: "1",
  additional_event_fee: "",
};

const defaultCategoriesText = tournamentCategories.join("\n");
const medalDisplayOrder = ["Gold", "Silver", "Bronze", "Participation", "Entered"];

const emptyEntry = {
  tournament_id: "",
  student_id: "",
  school_id: "",
  category: "",
  result_label: "",
  medal: "participation",
  special_needs: false,
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

type TournamentSchoolFeePayment = {
  id: string;
  tournament_id: string;
  school_id: string;
  status: "outstanding" | "paid";
  amount_zar: number | null;
  paid_at: string | null;
};

type CategoryResultDraft = {
  medal: string;
  result_label: string;
};

type TournamentSortKey = "student" | "school" | "result" | "points" | "category" | "age" | "rank";

type TournamentEntryControls = {
  sort: TournamentSortKey;
  school: string;
  result: string;
  category: string;
  gender: string;
};

export default function TournamentsClient() {
  const [token, setToken] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [feePayments, setFeePayments] = useState<TournamentSchoolFeePayment[]>([]);
  const [tournamentForm, setTournamentForm] = useState(emptyTournament);
  const [feeForm, setFeeForm] = useState(emptyFeeStructure);
  const [categoriesText, setCategoriesText] = useState(defaultCategoriesText);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [entryCategories, setEntryCategories] = useState<string[]>([]);
  const [entryCategoryDrafts, setEntryCategoryDrafts] = useState<Record<string, CategoryResultDraft>>({});
  const [entryControls, setEntryControls] = useState<Record<string, TournamentEntryControls>>({});
  const [editingTournamentId, setEditingTournamentId] = useState("");
  const [editingEntryId, setEditingEntryId] = useState("");
  const [error, setError] = useState("");
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
    setFeePayments(payload.feePayments ?? []);
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

  function updateFeeField(field: keyof typeof emptyFeeStructure, value: string) {
    setFeeForm((current) => ({ ...current, [field]: value }));
  }

  function updateEntryField(field: keyof typeof emptyEntry, value: string) {
    if (field === "tournament_id") {
      setEntryCategories([]);
      setEntryCategoryDrafts({});
      setEntryForm((current) => ({ ...current, tournament_id: value, category: "" }));
      return;
    }

    if (field === "student_id") {
      const selectedStudent = students.find((student) => student.id === value);
      setEntryCategories([]);
      setEntryCategoryDrafts({});
      setEntryForm((current) => ({
        ...current,
        student_id: value,
        school_id: selectedStudent?.school_id || "",
      }));
      return;
    }

    setEntryForm((current) => ({ ...current, [field]: value }));
  }

  function toggleEntryCategory(category: string, checked: boolean) {
    setEntryCategories((current) =>
      checked ? [...new Set([...current, category])] : current.filter((item) => item !== category),
    );
    setEntryCategoryDrafts((current) => {
      if (checked) {
        return {
          ...current,
          [category]: current[category] ?? { medal: entryForm.medal, result_label: entryForm.result_label },
        };
      }

      const remaining = { ...current };
      delete remaining[category];
      return remaining;
    });
    setEntryForm((current) => ({
      ...current,
      category: checked ? category : current.category === category ? "" : current.category,
    }));
  }

  function updateEntryCategoryDraft(category: string, field: keyof CategoryResultDraft, value: string) {
    setEntryCategoryDrafts((current) => ({
      ...current,
      [category]: {
        medal: current[category]?.medal ?? entryForm.medal,
        result_label: current[category]?.result_label ?? "",
        [field]: value,
      },
    }));
  }

  function resetTournamentForm() {
    setEditingTournamentId("");
    setTournamentForm({ ...emptyTournament, province_id: provinces[0]?.id || "" });
    setFeeForm(emptyFeeStructure);
    setCategoriesText(defaultCategoriesText);
  }

  function resetEntryForm() {
    setEditingEntryId("");
    setEntryCategories([]);
    setEntryCategoryDrafts({});
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
      age_calculation_basis: tournament.age_calculation_basis ?? "competition_date",
    });
    setFeeForm({
      base_fee: tournament.fee_structure?.base_fee !== undefined ? String(tournament.fee_structure.base_fee) : "",
      included_events: tournament.fee_structure?.included_events !== undefined ? String(tournament.fee_structure.included_events) : "1",
      additional_event_fee:
        tournament.fee_structure?.additional_event_fee !== undefined ? String(tournament.fee_structure.additional_event_fee) : "",
    });
    setCategoriesText((tournament.tournament_categories?.length ? tournament.tournament_categories : [...tournamentCategories]).join("\n"));
  }

function editEntry(entry: TournamentEntry) {
    setEditingEntryId(entry.id);
    setEntryCategories([]);
    setEntryCategoryDrafts({});
    setEntryForm({
      tournament_id: entry.tournament_id,
      student_id: entry.student_id,
      school_id: entry.school_id,
      category: entry.category ?? "",
      result_label: entry.result_label ?? "",
      medal: entry.medal ?? "participation",
      special_needs: entry.special_needs,
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

  function formatFee(value: number) {
    return `R${value.toFixed(2)}`;
  }

  function ageBasisLabel(value: string | null | undefined) {
    return value === "year_end" ? "Age on 31 Dec of tournament year" : "Age on competition date";
  }

  function csvCell(value: string | number | boolean | null | undefined) {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function fileSafeName(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "tournament-events";
  }

  function exportEntriesCsv(tournament: Tournament | null, tournamentEntries: TournamentEntry[]) {
    const rows = [
      [
        "Tournament",
        "Date",
        "Venue",
        "Student",
        "Age",
        "Gender",
        "Rank",
        "School",
        "Category",
        "Special needs",
        "Result",
        "Points",
        "Status",
      ],
      ...tournamentEntries.map((entry) => {
        const entryTournament = tournament ?? tournaments.find((item) => item.id === entry.tournament_id) ?? null;
        return [
          entryTournament?.name ?? entry.tournaments?.name ?? "",
          entryTournament?.starts_at ? formatTournamentDate(entryTournament.starts_at) : "",
          entryTournament?.venue ?? "",
          `${entry.students?.first_name ?? ""} ${entry.students?.last_name ?? ""}`.trim(),
          studentAgeForTournament(entry.students?.date_of_birth, entryTournament),
          formatGender(entry.students?.gender),
          entry.students?.belt_rank ?? "",
          entry.schools?.name ?? "",
          entry.category ?? "",
          entry.special_needs ? "Yes" : "No",
          entry.result_label || entry.medal || "Entered",
          entry.points ?? 0,
          entry.status,
        ];
      }),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileSafeName(tournament?.name ?? "all-tournament-events")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function tournamentAgeReferenceDate(tournament: Tournament | null) {
    const startDate = tournament?.starts_at ? new Date(tournament.starts_at) : new Date();
    const fallbackDate = Number.isNaN(startDate.getTime()) ? new Date() : startDate;

    if (tournament?.age_calculation_basis === "year_end") {
      return new Date(fallbackDate.getFullYear(), 11, 31);
    }

    return fallbackDate;
  }

  function studentAgeForTournament(dateOfBirth: string | null | undefined, tournament: Tournament | null) {
    if (!dateOfBirth) return "Not recorded";

    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return "Not recorded";

    const referenceDate = tournamentAgeReferenceDate(tournament);
    let age = referenceDate.getFullYear() - birthDate.getFullYear();
    const hasBirthdayPassed =
      referenceDate.getMonth() > birthDate.getMonth() ||
      (referenceDate.getMonth() === birthDate.getMonth() && referenceDate.getDate() >= birthDate.getDate());

    if (!hasBirthdayPassed) age -= 1;
    return String(age);
  }

  function formatGender(value: string | null | undefined) {
    if (!value) return "Not recorded";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function resultLabel(entry: TournamentEntry) {
    return entry.result_label || entry.medal || "Entered";
  }

  function studentName(entry: TournamentEntry) {
    return `${entry.students?.first_name ?? ""} ${entry.students?.last_name ?? ""}`.trim() || "Unknown student";
  }

  function medalLabel(value: string | null | undefined) {
    if (!value) return "Entered";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function controlsForTournament(tournamentId: string) {
    return entryControls[tournamentId] ?? { sort: "student", school: "", result: "", category: "", gender: "" };
  }

  function updateTournamentEntryControl(tournamentId: string, field: keyof TournamentEntryControls, value: string) {
    setEntryControls((current) => ({
      ...current,
      [tournamentId]: {
        ...controlsForTournament(tournamentId),
        [field]: value,
      },
    }));
  }

  function tournamentEntryFilterOptions(tournamentEntries: TournamentEntry[]) {
    return {
      schools: Array.from(new Set(tournamentEntries.map((entry) => entry.schools?.name ?? "No school"))).sort(),
      categories: Array.from(new Set(tournamentEntries.map((entry) => entry.category ?? "No category"))).sort(),
      results: Array.from(new Set(tournamentEntries.map((entry) => medalLabel(entry.medal)))).sort(),
      genders: Array.from(new Set(tournamentEntries.map((entry) => formatGender(entry.students?.gender)))).sort(),
    };
  }

  function filteredAndSortedEntries(tournament: Tournament, tournamentEntries: TournamentEntry[]) {
    const controls = controlsForTournament(tournament.id);
    const filteredEntries = tournamentEntries.filter((entry) => {
      if (controls.school && (entry.schools?.name ?? "No school") !== controls.school) return false;
      if (controls.category && (entry.category ?? "No category") !== controls.category) return false;
      if (controls.result && medalLabel(entry.medal) !== controls.result) return false;
      if (controls.gender && formatGender(entry.students?.gender) !== controls.gender) return false;
      return true;
    });

    return [...filteredEntries].sort((a, b) => {
      if (controls.sort === "points") return Number(b.points ?? 0) - Number(a.points ?? 0);
      if (controls.sort === "age") {
        const aAge = Number(studentAgeForTournament(a.students?.date_of_birth, tournament));
        const bAge = Number(studentAgeForTournament(b.students?.date_of_birth, tournament));
        return (Number.isFinite(aAge) ? aAge : 999) - (Number.isFinite(bAge) ? bAge : 999);
      }

      const values: Record<Exclude<TournamentSortKey, "points" | "age">, [string, string]> = {
        student: [studentName(a), studentName(b)],
        school: [a.schools?.name ?? "No school", b.schools?.name ?? "No school"],
        result: [resultLabel(a), resultLabel(b)],
        category: [a.category ?? "No category", b.category ?? "No category"],
        rank: [a.students?.belt_rank ?? "No rank", b.students?.belt_rank ?? "No rank"],
      };
      const [aValue, bValue] = values[controls.sort as Exclude<TournamentSortKey, "points" | "age">];
      return aValue.localeCompare(bValue);
    });
  }

  function tournamentStats(tournamentEntries: TournamentEntry[]) {
    const competitorIds = new Set(tournamentEntries.map((entry) => entry.student_id));
    const maleIds = new Set(tournamentEntries.filter((entry) => entry.students?.gender === "male").map((entry) => entry.student_id));
    const femaleIds = new Set(tournamentEntries.filter((entry) => entry.students?.gender === "female").map((entry) => entry.student_id));
    const specialNeedsIds = new Set(tournamentEntries.filter((entry) => entry.special_needs).map((entry) => entry.student_id));

    return {
      competitors: competitorIds.size,
      entries: tournamentEntries.length,
      results: tournamentEntries.filter((entry) => entry.medal || entry.result_label).length,
      male: maleIds.size,
      female: femaleIds.size,
      specialNeeds: specialNeedsIds.size,
      points: tournamentEntries.reduce((total, entry) => total + Number(entry.points ?? 0), 0),
    };
  }

  function countBy(items: string[]) {
    return items.reduce<Record<string, number>>((counts, item) => {
      counts[item] = (counts[item] ?? 0) + 1;
      return counts;
    }, {});
  }

  function sortedCategoryCounts(counts: Record<string, number>) {
    return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function sortedMedalCounts(counts: Record<string, number>) {
    return Object.entries(counts).sort((a, b) => {
      const aIndex = medalDisplayOrder.indexOf(a[0]);
      const bIndex = medalDisplayOrder.indexOf(b[0]);
      const safeAIndex = aIndex === -1 ? medalDisplayOrder.length : aIndex;
      const safeBIndex = bIndex === -1 ? medalDisplayOrder.length : bIndex;
      return safeAIndex - safeBIndex || a[0].localeCompare(b[0]);
    });
  }

  function topCompetitors(tournamentEntries: TournamentEntry[]) {
    const competitors = new Map<
      string,
      { id: string; name: string; school: string; points: number; entries: number; results: string[] }
    >();

    for (const entry of tournamentEntries) {
      const current = competitors.get(entry.student_id) ?? {
        id: entry.student_id,
        name: studentName(entry),
        school: entry.schools?.name ?? "No school",
        points: 0,
        entries: 0,
        results: [],
      };
      current.points += Number(entry.points ?? 0);
      current.entries += 1;
      if (entry.medal || entry.result_label) {
        current.results.push(`${entry.category ?? "No category"}: ${resultLabel(entry)}`);
      }
      competitors.set(entry.student_id, current);
    }

    return Array.from(competitors.values())
      .sort((a, b) => b.points - a.points || b.entries - a.entries || a.name.localeCompare(b.name))
      .slice(0, 10);
  }

  function categoriesFromText() {
    return Array.from(
      new Set(categoriesText.split(/\r?\n/).map((category) => category.trim()).filter(Boolean)),
    );
  }

  function tournamentCategoryList(tournamentId: string) {
    const tournament = tournaments.find((item) => item.id === tournamentId);
    return tournament?.tournament_categories?.length ? tournament.tournament_categories : [...tournamentCategories];
  }

  function feeRule(tournament: Tournament) {
    return {
      baseFee: Number(tournament.fee_structure?.base_fee ?? 0),
      includedEvents: Math.max(1, Number(tournament.fee_structure?.included_events ?? 1) || 1),
      additionalEventFee: Number(tournament.fee_structure?.additional_event_fee ?? 0),
    };
  }

  function feeSummary(tournament: Tournament) {
    const rule = feeRule(tournament);

    if (rule.baseFee <= 0) return "No fees set";
    return `First ${rule.includedEvents} event${rule.includedEvents === 1 ? "" : "s"}: ${formatFee(rule.baseFee)} | Each additional event: ${formatFee(rule.additionalEventFee)}`;
  }

  function feeForStudentEntries(tournament: Tournament, entryCount: number) {
    if (entryCount <= 0) return 0;

    const rule = feeRule(tournament);
    if (rule.baseFee <= 0) return 0;

    const additionalEntries = Math.max(0, entryCount - rule.includedEvents);
    return rule.baseFee + additionalEntries * rule.additionalEventFee;
  }

  function schoolFeeTotals(tournament: Tournament, tournamentEntries: TournamentEntry[]) {
    const schoolStudents = new Map<string, { schoolName: string; students: Map<string, number> }>();

    for (const entry of tournamentEntries) {
      const schoolId = entry.school_id;
      const schoolName = entry.schools?.name ?? "Unknown school";
      const current = schoolStudents.get(schoolId) ?? { schoolName, students: new Map<string, number>() };
      current.students.set(entry.student_id, (current.students.get(entry.student_id) ?? 0) + 1);
      schoolStudents.set(schoolId, current);
    }

    return Array.from(schoolStudents.entries())
      .map(([schoolId, total]) => {
        const payment = feePayments.find((item) => item.tournament_id === tournament.id && item.school_id === schoolId);
        return {
          schoolId,
          schoolName: total.schoolName,
          students: total.students.size,
          entries: Array.from(total.students.values()).reduce((sum, count) => sum + count, 0),
          total: Array.from(total.students.values()).reduce((sum, count) => sum + feeForStudentEntries(tournament, count), 0),
          paymentStatus: payment?.status ?? "outstanding",
          paidAt: payment?.paid_at ?? null,
        };
      })
      .sort((a, b) => b.total - a.total || a.schoolName.localeCompare(b.schoolName));
  }

  async function markTournamentSchoolFeePaid(tournamentId: string, schoolId: string, amountZar: number) {
    setBusy(true);
    setError("");

    const response = await fetch("/api/admin/tournament-school-fees", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tournament_id: tournamentId,
        school_id: schoolId,
        status: "paid",
        amount_zar: amountZar,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to mark tournament fee as paid.");
      return;
    }

    await loadTournaments(token);
  }

  const tournamentGroups = tournaments.map((tournament) => {
    const tournamentEntries = entries.filter((entry) => entry.tournament_id === tournament.id);
    const points = tournamentEntries.reduce((total, entry) => total + Number(entry.points ?? 0), 0);
    const competitors = new Set(tournamentEntries.map((entry) => entry.student_id)).size;

    return {
      tournament,
      entries: tournamentEntries,
      competitors,
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
        body: JSON.stringify({
          ...tournamentForm,
          fee_structure: {
            base_fee: Number(feeForm.base_fee) || 0,
            included_events: Math.max(1, Number(feeForm.included_events) || 1),
            additional_event_fee: Number(feeForm.additional_event_fee) || 0,
          },
          tournament_categories: categoriesFromText(),
        }),
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

    const categoriesToSave = editingEntryId ? [entryForm.category].filter(Boolean) : entryCategories;

    if (categoriesToSave.length === 0) {
      setBusy(false);
      setError(editingEntryId ? "Select a tournament category." : "Select at least one tournament category for this result.");
      return;
    }

    const responses = await Promise.all(
      categoriesToSave.map(async (category) => {
        const categoryDraft = entryCategoryDrafts[category] ?? {
          medal: entryForm.medal,
          result_label: entryForm.result_label,
        };
        const response = await fetch(
          editingEntryId ? `/api/admin/tournament-entries/${editingEntryId}` : "/api/admin/tournament-entries",
          {
            method: editingEntryId ? "PATCH" : "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...entryForm,
              category,
              medal: categoryDraft.medal,
              result_label: categoryDraft.result_label,
            }),
          },
        );
        return { ok: response.ok, payload: await response.json().catch(() => ({})) };
      }),
    );
    setBusy(false);

    const failedResponse = responses.find((response) => !response.ok);
    if (failedResponse) {
      setError(failedResponse.payload.error ?? "Unable to save tournament event.");
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
      setError(payload.error ?? "Unable to delete tournament event.");
      return;
    }

    await loadTournaments(token);
  }

  async function clearEntryResult(id: string) {
    setBusy(true);
    const response = await fetch(`/api/admin/tournament-entries/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ clear_result: true }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to clear tournament result.");
      return;
    }

    await loadTournaments(token);
  }

  function renderTournamentGroup(
    tournament: Tournament,
    tournamentEntries: TournamentEntry[],
    competitors: number,
    points: number,
    index: number,
  ) {
    const controls = controlsForTournament(tournament.id);
    const filterOptions = tournamentEntryFilterOptions(tournamentEntries);
    const visibleEntries = filteredAndSortedEntries(tournament, tournamentEntries);
    const stats = tournamentStats(tournamentEntries);
    const categoryCounts = countBy(tournamentEntries.map((entry) => entry.category ?? "No category"));
    const medalCounts = countBy(tournamentEntries.map((entry) => medalLabel(entry.medal)));
    const schoolTotals = schoolFeeTotals(tournament, tournamentEntries);
    const topRows = topCompetitors(tournamentEntries);

    return (
      <details className="tournament-group" key={tournament.id} open={index === 0}>
        <summary>
          <span>
            <strong>{tournament.name}</strong>
            <small>{formatTournamentDate(tournament.starts_at)} | {tournament.venue ?? "No venue"}</small>
          </span>
          <span className="tournament-summary-counts">
            <b>{competitors}</b> competitors
            <b>{tournamentEntries.length}</b> events
            <b>{points}</b> points
            <b>{formatFee(schoolTotals.reduce((total, school) => total + school.total, 0))}</b> fees
          </span>
        </summary>

        <section className="tournament-insights">
          <div className="section-title" style={{ marginBottom: 12 }}>
            <div>
              <h3 style={{ marginTop: 0 }}>Tournament stats</h3>
              <p>Totals, category spread, medal summary, and top competitors for this tournament.</p>
            </div>
            <button className="secondary-button compact" disabled={tournamentEntries.length === 0} onClick={() => exportEntriesCsv(tournament, tournamentEntries)} type="button">
              Export events
            </button>
          </div>
          <dl className="tournament-mini-grid">
            <div><dt>Competitors</dt><dd>{stats.competitors}</dd></div>
            <div><dt>Events</dt><dd>{stats.entries}</dd></div>
            <div><dt>Results</dt><dd>{stats.results}</dd></div>
            <div><dt>Points</dt><dd>{stats.points}</dd></div>
            <div><dt>Male</dt><dd>{stats.male}</dd></div>
            <div><dt>Female</dt><dd>{stats.female}</dd></div>
            <div><dt>Special needs</dt><dd>{stats.specialNeeds}</dd></div>
          </dl>

          <div className="tournament-stat-columns">
            <article className="stat-breakdown-card">
              <h4>Categories</h4>
              <div className="stat-chip-list">
                {sortedCategoryCounts(categoryCounts).map(([label, count]) => <span key={label}>{label}: {count}</span>)}
              </div>
            </article>
            <article className="stat-breakdown-card">
              <h4>Results</h4>
              <div className="result-chip-list">
                {sortedMedalCounts(medalCounts).map(([label, count]) => (
                  <span className={`result-chip result-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} key={label}>
                    <b>{count}</b>
                    {label}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="content-shell" style={{ margin: "14px 0" }}>
          <h3 style={{ marginTop: 0 }}>Top 10 participants of the day</h3>
          {topRows.length === 0 ? (
            <p className="muted">No competitors recorded yet.</p>
          ) : (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>School</th>
                    <th>Events</th>
                    <th>Results</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {topRows.map((row, rowIndex) => (
                    <tr key={row.id}>
                      <td>{rowIndex + 1}</td>
                      <td>{row.name}</td>
                      <td>{row.school}</td>
                      <td>{row.entries}</td>
                      <td>{row.results.length ? row.results.join(" | ") : "No result yet"}</td>
                      <td>{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="content-shell" style={{ margin: "14px 0" }}>
          <h3 style={{ marginTop: 0 }}>School fee totals</h3>
          {schoolTotals.length === 0 ? (
            <p className="muted">No school events yet.</p>
          ) : (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Students</th>
                    <th>Events</th>
                    <th>Total fee</th>
                    <th>Payment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolTotals.map((school) => (
                    <tr key={school.schoolId}>
                      <td>{school.schoolName}</td>
                      <td>{school.students}</td>
                      <td>{school.entries}</td>
                      <td>{formatFee(school.total)}</td>
                      <td>
                        <span className={`status-pill status-${school.paymentStatus}`}>
                          {school.paymentStatus}
                        </span>
                      </td>
                      <td>
                        {school.paymentStatus === "paid" ? (
                          <span className="small-note">
                            {school.paidAt ? `Paid ${new Date(school.paidAt).toLocaleDateString()}` : "Paid"}
                          </span>
                        ) : (
                          <button
                            className="primary-button compact"
                            disabled={busy}
                            onClick={() => markTournamentSchoolFeePaid(tournament.id, school.schoolId, school.total)}
                            type="button"
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {tournamentEntries.length === 0 ? (
          <article className="empty-state">No results imported for this tournament yet.</article>
        ) : (
          <section className="content-shell" style={{ margin: "14px 0" }}>
            <div className="tournament-table-controls">
              <label>
                Sort by
                <select value={controls.sort} onChange={(event) => updateTournamentEntryControl(tournament.id, "sort", event.target.value)}>
                  <option value="student">Student</option>
                  <option value="school">School</option>
                  <option value="result">Result</option>
                  <option value="points">Points</option>
                  <option value="category">Category</option>
                  <option value="age">Age</option>
                  <option value="rank">Rank</option>
                </select>
              </label>
              <label>
                School
                <select value={controls.school} onChange={(event) => updateTournamentEntryControl(tournament.id, "school", event.target.value)}>
                  <option value="">All schools</option>
                  {filterOptions.schools.map((school) => <option key={school} value={school}>{school}</option>)}
                </select>
              </label>
              <label>
                Category
                <select value={controls.category} onChange={(event) => updateTournamentEntryControl(tournament.id, "category", event.target.value)}>
                  <option value="">All categories</option>
                  {filterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label>
                Result
                <select value={controls.result} onChange={(event) => updateTournamentEntryControl(tournament.id, "result", event.target.value)}>
                  <option value="">All results</option>
                  {filterOptions.results.map((result) => <option key={result} value={result}>{result}</option>)}
                </select>
              </label>
              <label>
                Gender
                <select value={controls.gender} onChange={(event) => updateTournamentEntryControl(tournament.id, "gender", event.target.value)}>
                  <option value="">All genders</option>
                  {filterOptions.genders.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
                </select>
              </label>
            </div>
            <p className="small-note">Showing {visibleEntries.length} of {tournamentEntries.length} events.</p>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Rank</th>
                    <th>School</th>
                    <th>Category</th>
                    <th>Special needs</th>
                    <th>Result</th>
                    <th>Points</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{studentName(entry)}</td>
                      <td>{studentAgeForTournament(entry.students?.date_of_birth, tournament)}</td>
                      <td>{formatGender(entry.students?.gender)}</td>
                      <td>{entry.students?.belt_rank ?? "No rank"}</td>
                      <td>{entry.schools?.name ?? "No school"}</td>
                      <td>{entry.category ?? "No category"}</td>
                      <td>{entry.special_needs ? "Yes" : "No"}</td>
                      <td>{resultLabel(entry)}</td>
                      <td>{entry.points ?? 0}</td>
                      <td>
                        <div className="row-actions">
                          <button className="secondary-button compact" onClick={() => editEntry(entry)} type="button">Edit</button>
                          <button className="danger-button compact" disabled={busy || (!entry.medal && !entry.result_label)} onClick={() => clearEntryResult(entry.id)} type="button">Clear result</button>
                          <button className="danger-button compact" disabled={busy} onClick={() => deleteEntry(entry.id)} type="button">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </details>
    );
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <BrandMark compact />
          <p className="eyebrow">Admin</p>
          <h1>Tournaments</h1>
          <p className="muted">Create tournaments, add student events, and record results.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-button compact" href="/dashboard">Dashboard</Link>
          <SignOutButton />
        </div>
      </header>

      {error ? <section className="content-shell"><p className="form-error">{error}</p></section> : null}

      <section className="section-title">
        <h2>School leaderboard</h2>
        <p>Ranked by points, then medals.</p>
      </section>
      <section className="content-shell leaderboard-shell">
        {leaderboard.length === 0 ? (
          <article className="empty-state">No tournament results recorded yet.</article>
        ) : (
          <>
            <div className="leaderboard-podium" aria-label="Top three schools">
              {leaderboard.slice(0, 3).map((row, index) => (
                <article className={`podium-card podium-rank-${index + 1}`} key={row.school_id}>
                  <span className="podium-rank">#{index + 1}</span>
                  <h3>{row.school_name}</h3>
                  <strong>{row.points}</strong>
                  <span>points</span>
                  <div className="medal-strip">
                    <span><b>{row.gold}</b> Gold</span>
                    <span><b>{row.silver}</b> Silver</span>
                    <span><b>{row.bronze}</b> Bronze</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="responsive-table leaderboard-table">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>School</th>
                    <th>Points</th>
                    <th>Gold</th>
                    <th>Silver</th>
                    <th>Bronze</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, index) => (
                    <tr key={row.school_id}>
                      <td><span className="rank-pill">#{index + 1}</span></td>
                      <td>{row.school_name}</td>
                      <td><strong>{row.points}</strong></td>
                      <td>{row.gold}</td>
                      <td>{row.silver}</td>
                      <td>{row.bronze}</td>
                      <td>{row.entries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="two-column-workspace">
        <details className="collapsible-form-panel" open={Boolean(editingTournamentId)}>
          <summary>
            <span>
              <strong>{editingTournamentId ? "Edit tournament" : "Add tournament"}</strong>
              <small>Dates, fees, registration closing date, and categories.</small>
            </span>
          </summary>
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
          <label>
            Registration closes
            <input
              type="datetime-local"
              value={tournamentForm.registration_closes_at}
              onChange={(event) => updateTournamentField("registration_closes_at", event.target.value)}
            />
          </label>
          <label>
            Age calculation
            <select
              value={tournamentForm.age_calculation_basis}
              onChange={(event) => updateTournamentField("age_calculation_basis", event.target.value)}
            >
              <option value="competition_date">Age on competition date</option>
              <option value="year_end">Age on 31 Dec of tournament year</option>
            </select>
          </label>
          <fieldset style={{ border: "1px solid #d9dee7", borderRadius: 8, display: "grid", gap: 12, gridColumn: "1 / -1", padding: 16 }}>
            <legend style={{ fontWeight: 800, padding: "0 6px" }}>Tournament fees</legend>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label>
                Base fee
                <input min="0" onChange={(event) => updateFeeField("base_fee", event.target.value)} placeholder="350.00" step="0.01" type="number" value={feeForm.base_fee} />
              </label>
              <label>
                Base fee includes events
                <input min="1" onChange={(event) => updateFeeField("included_events", event.target.value)} step="1" type="number" value={feeForm.included_events} />
              </label>
              <label>
                Each additional event
                <input min="0" onChange={(event) => updateFeeField("additional_event_fee", event.target.value)} placeholder="50.00" step="0.01" type="number" value={feeForm.additional_event_fee} />
              </label>
            </div>
            <p className="small-note">Examples: first event R350 and each additional event R50, or first two events R350 and each additional event R50.</p>
          </fieldset>
          <label style={{ gridColumn: "1 / -1" }}>
            Tournament categories
            <textarea
              onChange={(event) => setCategoriesText(event.target.value)}
              rows={8}
              value={categoriesText}
            />
          </label>
          <p className="small-note">One category per line. Defaults include Inventive and Elevate.</p>
          <button className="primary-button compact" disabled={busy} type="submit">
            {editingTournamentId ? "Save tournament" : "Add tournament"}
          </button>
          </form>
        </details>

        <details className="collapsible-form-panel" open={Boolean(editingEntryId)}>
          <summary>
            <span>
              <strong>{editingEntryId ? "Edit result" : "Add event / result"}</strong>
              <small>Select a student, categories, special needs, and results.</small>
            </span>
          </summary>
          <form className="admin-form" onSubmit={saveEntry}>
          <h2>{editingEntryId ? "Edit result" : "Add event / result"}</h2>
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
          {editingEntryId ? (
            <label>
              Category
              <select value={entryForm.category} onChange={(event) => updateEntryField("category", event.target.value)} required>
                <option value="">Select category</option>
                {tournamentCategoryList(entryForm.tournament_id).map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
          ) : (
            <fieldset style={{ border: "1px solid #d9dee7", borderRadius: 8, display: "grid", gap: 12, gridColumn: "1 / -1", padding: 16 }}>
              <legend style={{ fontWeight: 800, padding: "0 6px" }}>Result categories</legend>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                {tournamentCategoryList(entryForm.tournament_id).map((category) => {
                  const isSelected = entryCategories.includes(category);
                  const draft = entryCategoryDrafts[category] ?? { medal: entryForm.medal, result_label: entryForm.result_label };

                  return (
                    <div key={category} style={{ border: "1px solid #d9dee7", borderRadius: 8, display: "grid", gap: 10, padding: 10 }}>
                      <label className="checkbox-label">
                        <input
                          checked={isSelected}
                          onChange={(event) => toggleEntryCategory(category, event.target.checked)}
                          type="checkbox"
                        />
                        {category}
                      </label>
                      {isSelected ? (
                        <>
                          <label>
                            Result
                            <select value={draft.medal} onChange={(event) => updateEntryCategoryDraft(category, "medal", event.target.value)}>
                              {tournamentResults.map((result) => (
                                <option key={result} value={result}>{result}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Result note
                            <input value={draft.result_label} onChange={(event) => updateEntryCategoryDraft(category, "result_label", event.target.value)} />
                          </label>
                          <p className="small-note">Points: {tournamentPointsForResult(draft.medal) ?? 0}</p>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          )}
          <label className="checkbox-label"><input checked={entryForm.special_needs} onChange={(event) => setEntryForm((current) => ({ ...current, special_needs: event.target.checked }))} type="checkbox" /> Special needs</label>
          {editingEntryId ? (
            <>
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
            </>
          ) : null}
          <button className="primary-button compact" disabled={busy || tournaments.length === 0 || students.length === 0 || (!editingEntryId && entryCategories.length === 0)} type="submit">
            {editingEntryId ? "Save result" : "Add selected results"}
          </button>
          </form>
        </details>
      </section>

      <section className="section-title">
        <h2>Tournament register</h2>
        <p>Quick overview of all tournaments and their imported results.</p>
      </section>
      <section className="tournament-card-grid">
        {tournamentGroups.map(({ tournament, entries: tournamentEntries, competitors, points, results }) => (
          <article className="tournament-card" key={tournament.id}>
            <div className="tournament-card-header">
              <div>
                <h2>{tournament.name}</h2>
                <p>{tournament.venue ?? "No venue"} | {formatTournamentDate(tournament.starts_at)}</p>
              </div>
              <span className="status-pill">{tournament.provinces?.name ?? "National"}</span>
            </div>
            <dl className="tournament-mini-grid">
              <div><dt>Competitors</dt><dd>{competitors}</dd></div>
              <div><dt>Events</dt><dd>{tournamentEntries.length}</dd></div>
              <div><dt>Results</dt><dd>{results}</dd></div>
              <div><dt>Points</dt><dd>{points}</dd></div>
              <div><dt>Registration closes</dt><dd>{tournament.registration_closes_at ? formatTournamentDate(tournament.registration_closes_at) : "Not set"}</dd></div>
              <div><dt>Age rule</dt><dd>{ageBasisLabel(tournament.age_calculation_basis)}</dd></div>
              <div><dt>Categories</dt><dd>{tournament.tournament_categories?.length ?? tournamentCategories.length}</dd></div>
            </dl>
            <p className="small-note">{feeSummary(tournament)}</p>
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
        <button className="secondary-button compact" disabled={entries.length === 0} onClick={() => exportEntriesCsv(null, entries)} type="button">
          Export all events
        </button>
      </section>
      <section className="tournament-accordion-list">
        {tournamentGroups.length === 0 ? (
          <article className="empty-state">No tournaments recorded yet.</article>
        ) : (
          tournamentGroups.map(({ tournament, entries: tournamentEntries, competitors, points }, index) =>
            renderTournamentGroup(tournament, tournamentEntries, competitors, points, index),
          )
        )}
      </section>
    </main>
  );
}
