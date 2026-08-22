export type DutyApplicability = "home" | "away" | "both";
export type TournamentType = "home" | "away";

export interface DutyType {
  id: string;
  name: string;
  appliesTo: DutyApplicability;
  sortOrder: number;
  createdAt: string;
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

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  eventDate: string; // ISO yyyy-mm-dd
  location: string | null;
  notes: string | null;
  createdAt: string;
}

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

export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  home: "Heimturnier",
  away: "Auswärtsturnier",
};

export const APPLIES_TO_LABELS: Record<DutyApplicability, string> = {
  home: "nur Heimturnier",
  away: "nur Auswärtsturnier",
  both: "Heim- und Auswärtsturnier",
};
