export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

export type Role = "admin" | "trainer";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  password_salt: string;
  role: Role;
  created_at: string;
}

export interface UserWithJugenden extends User {
  jugendIds: string[];
}

export type DutyApplicability = "home" | "away" | "both";
export type TournamentType = "home" | "away";

export interface Jugend {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface JugendRow {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
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

export interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  jugend_id: string;
  jugend_name: string | null;
  sort_order: number;
  created_at: string;
}

export interface DutyType {
  id: string;
  name: string;
  appliesTo: DutyApplicability;
  sortOrder: number;
  createdAt: string;
}

export interface DutyTypeRow {
  id: string;
  name: string;
  applies_to: DutyApplicability;
  sort_order: number;
  created_at: string;
}

export interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  childName: string | null;
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

export interface ParentRow {
  id: string;
  first_name: string;
  last_name: string;
  child_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: number;
  player_id: string | null;
  player_first_name: string | null;
  player_last_name: string | null;
  role_label: string | null;
  jugend_id: string | null;
  jugend_name: string | null;
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  notes: string | null;
  jugendId: string | null;
  jugendName: string | null;
  createdAt: string;
}

export interface TournamentRow {
  id: string;
  name: string;
  type: TournamentType;
  event_date: string;
  event_time: string | null;
  location: string | null;
  notes: string | null;
  jugend_id: string | null;
  jugend_name: string | null;
  created_at: string;
}

export interface Slot {
  id: string;
  tournamentId: string;
  dutyTypeId: string;
  label: string | null;
  time: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface SlotRow {
  id: string;
  tournament_id: string;
  duty_type_id: string;
  label: string | null;
  time: string | null;
  sort_order: number;
  created_at: string;
}

export type AssignmentStatus = "confirmed" | "pending";

export interface Assignment {
  id: string;
  slotId: string;
  tournamentId: string;
  parentId: string;
  assignedAt: string;
  note: string | null;
  status: AssignmentStatus;
}

export interface AssignmentRow {
  id: string;
  slot_id: string;
  tournament_id: string;
  parent_id: string;
  assigned_at: string;
  note: string | null;
  status: AssignmentStatus;
}

// Angereicherter Slot inkl. Dienst-Typ-Name und (falls vorhanden) Zuteilung -
// so wie ihn Admin- und öffentliche Ansicht gemeinsam benötigen.
export interface SlotWithAssignment {
  id: string;
  label: string | null;
  time: string | null;
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
  // Vom Trainer/Admin ausgewählte, bei diesem Turnier verfügbare Spieler -
  // leer = keine Einschränkung (alle Eltern der Jugend kommen infrage).
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
