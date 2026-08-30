import type { CashTransactionCategory } from "./types";

// Gemeinsam von TournamentCashBox (Turnier-Kasse) und Kassenbuch (vereinsweite
// Übersicht + allgemeine Buchungen) genutzt, damit Formatierung und
// Kategorie-Beschriftungen an beiden Stellen konsistent bleiben.
export const CASH_CATEGORY_LABELS: Record<CashTransactionCategory, string> = {
  sales: "Verkauf / Einnahmen",
  drinks: "Getränke",
  grill: "Grillgut",
  supplies: "Becher, Servietten, Besteck",
  gas: "Gasflasche",
  equipment: "Ausstattung / Geräte",
  other: "Sonstiges",
};

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function eurosToCents(value: string): number | null {
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}
