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
