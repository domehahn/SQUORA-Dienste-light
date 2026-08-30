export type DutyApplicability = "home" | "away" | "both";
export type TournamentType = "home" | "away";
export type Role = "admin" | "trainer";
export type AssignmentStatus = "confirmed" | "pending";

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  jugendIds: string[];
}

export interface Jugend {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string | null;
  quantity: number;
  minQuantity: number;
  maxQuantity: number | null;
  note: string | null;
  jugendId: string | null;
  jugendName: string | null;
  sortOrder: number;
  createdAt: string;
}

export type CashTransactionKind = "income" | "expense";
export type CashTransactionCategory = "sales" | "drinks" | "grill" | "supplies" | "gas" | "equipment" | "other";

export interface CashTransaction {
  id: string;
  // null = allgemeine, nicht turniergebundene Buchung (z.B. Anschaffung
  // Sportgeräte) im vereinsweiten Kassenbuch.
  tournamentId: string | null;
  kind: CashTransactionKind;
  category: CashTransactionCategory;
  description: string;
  amountCents: number;
  occurredOn: string;
  createdAt: string;
}

export interface TournamentCashBox {
  tournamentId: string;
  openingBalanceCents: number;
  incomeCents: number;
  expenseCents: number;
  currentBalanceCents: number;
  transactions: CashTransaction[];
}

export interface TournamentCashBoxSummary {
  tournamentId: string;
  tournamentName: string;
  eventDate: string;
  jugendId: string | null;
  jugendName: string | null;
  currentBalanceCents: number;
}

export interface ClubCashBook {
  tournamentBoxes: TournamentCashBoxSummary[];
  generalTransactions: CashTransaction[];
  generalIncomeCents: number;
  generalExpenseCents: number;
  generalBalanceCents: number;
  totalBalanceCents: number;
}

export type InventoryLevel = "low" | "high" | "ok";

// Bestandsstatus: "low" wenn unter Mindestbestand, "high" wenn ein
// Maximalbestand gesetzt UND überschritten ist, sonst "ok".
export function inventoryLevel(item: Pick<InventoryItem, "quantity" | "minQuantity" | "maxQuantity">): InventoryLevel {
  if (item.quantity < item.minQuantity) return "low";
  if (item.maxQuantity !== null && item.quantity > item.maxQuantity) return "high";
  return "ok";
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jugendId: string;
  jugendName: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface DutyType {
  id: string;
  name: string;
  appliesTo: DutyApplicability;
  sortOrder: number;
  createdAt: string;
}

export interface Parent {
  id: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  playerId: string | null;
  playerName: string | null;
  roleLabel: string | null;
  jugendId: string | null;
  jugendName: string | null;
  createdAt: string;
}

// Kompaktes Anzeigelabel für ein Elternteil, überall dort verwendet, wo
// bisher der eigene Elternname stand (Turnier-Zuteilung, Eltern-Liste).
export function parentLabel(p: Pick<Parent, "playerName" | "roleLabel">): string {
  if (!p.playerName) return "Eltern (kein Spieler zugeordnet)";
  const base = `Eltern von ${p.playerName}`;
  return p.roleLabel ? `${base} (${p.roleLabel})` : base;
}

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  eventDate: string; // ISO yyyy-mm-dd
  eventTime: string | null; // HH:MM
  location: string | null;
  notes: string | null;
  jugendId: string | null;
  jugendName: string | null;
  createdAt: string;
}

export interface SlotWithAssignment {
  id: string;
  label: string | null;
  time: string | null; // HH:MM
  sortOrder: number;
  dutyTypeId: string;
  dutyTypeName: string;
  assignment: {
    parentId: string;
    parentName: string;
    status: AssignmentStatus;
    note: string | null;
  } | null;
}

export interface TournamentDetail extends Tournament {
  slots: SlotWithAssignment[];
  availablePlayerIds: string[];
}

export interface ParentAssignmentHistoryEntry {
  assignmentId: string;
  tournamentId: string;
  tournamentName: string;
  eventDate: string;
  eventTime: string | null;
  dutyTypeName: string;
  label: string | null;
  slotTime: string | null;
  status: AssignmentStatus;
}

export interface FairnessRow {
  parentId: string;
  parentName: string;
  active: boolean;
  jugendId: string | null;
  total: number;
  byDutyType: Record<string, number>;
}

export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  home: "Heimturnier",
  away: "Auswärtsturnier",
};

export const APPLIES_TO_LABELS: Record<DutyApplicability, string> = {
  home: "nur Heimturnier",
  away: "nur Auswärtsturnier",
  both: "Heim- und Auswärtsturnier",
};
