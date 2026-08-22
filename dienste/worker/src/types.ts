export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

export type DutyApplicability = "home" | "away" | "both";
export type TournamentType = "home" | "away";

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
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  eventDate: string;
  location: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TournamentRow {
  id: string;
  name: string;
  type: TournamentType;
  event_date: string;
  location: string | null;
  notes: string | null;
  created_at: string;
}

export interface Slot {
  id: string;
  tournamentId: string;
  dutyTypeId: string;
  label: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface SlotRow {
  id: string;
  tournament_id: string;
  duty_type_id: string;
  label: string | null;
  sort_order: number;
  created_at: string;
}

export interface Assignment {
  id: string;
  slotId: string;
  tournamentId: string;
  parentId: string;
  assignedAt: string;
  note: string | null;
}

export interface AssignmentRow {
  id: string;
  slot_id: string;
  tournament_id: string;
  parent_id: string;
  assigned_at: string;
  note: string | null;
}

// Angereicherter Slot inkl. Dienst-Typ-Name und (falls vorhanden) Zuteilung -
// so wie ihn Admin- und öffentliche Ansicht gemeinsam benötigen.
export interface SlotWithAssignment {
  id: string;
  label: string | null;
  sortOrder: number;
  dutyTypeId: string;
  dutyTypeName: string;
  assignment: {
    parentId: string;
    parentName: string;
  } | null;
}

export interface TournamentDetail extends Tournament {
  slots: SlotWithAssignment[];
}

export interface FairnessRow {
  parentId: string;
  parentName: string;
  active: boolean;
  total: number;
  byDutyType: Record<string, number>;
}
