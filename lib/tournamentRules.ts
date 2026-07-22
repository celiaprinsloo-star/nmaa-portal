export const tournamentCategories = [
  "Form",
  "Weapons Form",
  "Escrima Sparring",
  "Sparring",
  "Sword Sparring",
  "Continuous Sparring",
  "Inventive",
  "Elevate",
] as const;

export const tournamentResults = ["gold", "silver", "bronze", "participation"] as const;

export function tournamentPointsForResult(result: string | null | undefined) {
  const normalized = String(result ?? "").toLowerCase();

  if (normalized === "gold") return 10;
  if (normalized === "silver") return 8;
  if (normalized === "bronze") return 5;
  if (normalized === "participation") return 2;

  return null;
}

export function normalizeTournamentResult(result: string | null | undefined) {
  const normalized = String(result ?? "").trim().toLowerCase();
  return tournamentResults.includes(normalized as (typeof tournamentResults)[number])
    ? normalized
    : "participation";
}

export function normalizeOptionalTournamentResult(result: string | null | undefined) {
  const normalized = String(result ?? "").trim().toLowerCase();
  return tournamentResults.includes(normalized as (typeof tournamentResults)[number])
    ? normalized
    : null;
}

export function normalizeTournamentCategory(category: string | null | undefined) {
  const normalized = String(category ?? "").trim();
  return normalized;
}
