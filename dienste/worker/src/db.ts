import type {
  Assignment,
  AssignmentRow,
  DutyType,
  DutyTypeRow,
  FairnessRow,
  Parent,
  ParentRow,
  Slot,
  SlotRow,
  SlotWithAssignment,
  Tournament,
  TournamentDetail,
  TournamentRow,
  User,
  UserRow,
} from "./types";

function rowToUser(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}

function rowToDutyType(row: DutyTypeRow): DutyType {
  return {
    id: row.id,
    name: row.name,
    appliesTo: row.applies_to,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToParent(row: ParentRow): Parent {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    childName: row.child_name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

function rowToTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    eventDate: row.event_date,
    location: row.location,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function rowToSlot(row: SlotRow): Slot {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    dutyTypeId: row.duty_type_id,
    label: row.label,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    slotId: row.slot_id,
    tournamentId: row.tournament_id,
    parentId: row.parent_id,
    assignedAt: row.assigned_at,
    note: row.note,
  };
}

export function parentDisplayName(p: { firstName: string; lastName: string; childName?: string | null }): string {
  const base = `${p.firstName} ${p.lastName}`;
  return p.childName ? `${base} (${p.childName})` : base;
}

// --- Nutzer ---------------------------------------------------------------

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  return row ? rowToUser(row) : null;
}

// --- Dienst-Typen ----------------------------------------------------------

export async function listDutyTypes(db: D1Database): Promise<DutyType[]> {
  const { results } = await db
    .prepare("SELECT * FROM duty_types ORDER BY sort_order ASC, name ASC")
    .all<DutyTypeRow>();
  return results.map(rowToDutyType);
}

export async function createDutyType(
  db: D1Database,
  input: { name: string; appliesTo: string; sortOrder: number }
): Promise<DutyType> {
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO duty_types (id, name, applies_to, sort_order) VALUES (?, ?, ?, ?)")
    .bind(id, input.name, input.appliesTo, input.sortOrder)
    .run();
  const row = await db.prepare("SELECT * FROM duty_types WHERE id = ?").bind(id).first<DutyTypeRow>();
  return rowToDutyType(row as DutyTypeRow);
}

export async function updateDutyType(
  db: D1Database,
  id: string,
  input: { name: string; appliesTo: string; sortOrder: number }
): Promise<DutyType | null> {
  await db
    .prepare("UPDATE duty_types SET name = ?, applies_to = ?, sort_order = ? WHERE id = ?")
    .bind(input.name, input.appliesTo, input.sortOrder, id)
    .run();
  const row = await db.prepare("SELECT * FROM duty_types WHERE id = ?").bind(id).first<DutyTypeRow>();
  return row ? rowToDutyType(row) : null;
}

export async function deleteDutyType(db: D1Database, id: string): Promise<{ ok: boolean; inUse: boolean }> {
  const used = await db
    .prepare("SELECT 1 FROM tournament_slots WHERE duty_type_id = ? LIMIT 1")
    .bind(id)
    .first();
  if (used) return { ok: false, inUse: true };
  await db.prepare("DELETE FROM duty_types WHERE id = ?").bind(id).run();
  return { ok: true, inUse: false };
}

// --- Eltern ----------------------------------------------------------------

export async function listParents(db: D1Database): Promise<Parent[]> {
  const { results } = await db
    .prepare("SELECT * FROM parents ORDER BY last_name ASC, first_name ASC")
    .all<ParentRow>();
  return results.map(rowToParent);
}

export async function createParent(
  db: D1Database,
  input: {
    firstName: string;
    lastName: string;
    childName: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    active: boolean;
  }
): Promise<Parent> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO parents (id, first_name, last_name, child_name, email, phone, notes, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      id,
      input.firstName,
      input.lastName,
      input.childName,
      input.email,
      input.phone,
      input.notes,
      input.active ? 1 : 0
    )
    .run();
  const row = await db.prepare("SELECT * FROM parents WHERE id = ?").bind(id).first<ParentRow>();
  return rowToParent(row as ParentRow);
}

export async function updateParent(
  db: D1Database,
  id: string,
  input: {
    firstName: string;
    lastName: string;
    childName: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    active: boolean;
  }
): Promise<Parent | null> {
  await db
    .prepare(
      "UPDATE parents SET first_name = ?, last_name = ?, child_name = ?, email = ?, phone = ?, notes = ?, active = ? WHERE id = ?"
    )
    .bind(
      input.firstName,
      input.lastName,
      input.childName,
      input.email,
      input.phone,
      input.notes,
      input.active ? 1 : 0,
      id
    )
    .run();
  const row = await db.prepare("SELECT * FROM parents WHERE id = ?").bind(id).first<ParentRow>();
  return row ? rowToParent(row) : null;
}

export async function deleteParent(db: D1Database, id: string): Promise<{ ok: boolean; inUse: boolean }> {
  const used = await db.prepare("SELECT 1 FROM assignments WHERE parent_id = ? LIMIT 1").bind(id).first();
  if (used) return { ok: false, inUse: true };
  await db.prepare("DELETE FROM parents WHERE id = ?").bind(id).run();
  return { ok: true, inUse: false };
}

// --- Turniere ----------------------------------------------------------------

export async function listTournaments(db: D1Database): Promise<Tournament[]> {
  const { results } = await db
    .prepare("SELECT * FROM tournaments ORDER BY event_date ASC")
    .all<TournamentRow>();
  return results.map(rowToTournament);
}

export async function createTournament(
  db: D1Database,
  input: { name: string; type: string; eventDate: string; location: string | null; notes: string | null }
): Promise<Tournament> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO tournaments (id, name, type, event_date, location, notes) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id, input.name, input.type, input.eventDate, input.location, input.notes)
    .run();
  const row = await db.prepare("SELECT * FROM tournaments WHERE id = ?").bind(id).first<TournamentRow>();
  return rowToTournament(row as TournamentRow);
}

export async function updateTournament(
  db: D1Database,
  id: string,
  input: { name: string; type: string; eventDate: string; location: string | null; notes: string | null }
): Promise<Tournament | null> {
  await db
    .prepare(
      "UPDATE tournaments SET name = ?, type = ?, event_date = ?, location = ?, notes = ? WHERE id = ?"
    )
    .bind(input.name, input.type, input.eventDate, input.location, input.notes, id)
    .run();
  const row = await db.prepare("SELECT * FROM tournaments WHERE id = ?").bind(id).first<TournamentRow>();
  return row ? rowToTournament(row) : null;
}

export async function deleteTournament(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM tournaments WHERE id = ?").bind(id).run();
}

export async function getTournament(db: D1Database, id: string): Promise<Tournament | null> {
  const row = await db.prepare("SELECT * FROM tournaments WHERE id = ?").bind(id).first<TournamentRow>();
  return row ? rowToTournament(row) : null;
}

interface SlotJoinRow {
  id: string;
  label: string | null;
  sort_order: number;
  duty_type_id: string;
  duty_type_name: string;
  assignment_parent_id: string | null;
  assignment_first_name: string | null;
  assignment_last_name: string | null;
  assignment_child_name: string | null;
}

async function slotsWithAssignments(db: D1Database, tournamentId: string): Promise<SlotWithAssignment[]> {
  const { results } = await db
    .prepare(
      `SELECT
         s.id as id,
         s.label as label,
         s.sort_order as sort_order,
         s.duty_type_id as duty_type_id,
         dt.name as duty_type_name,
         p.id as assignment_parent_id,
         p.first_name as assignment_first_name,
         p.last_name as assignment_last_name,
         p.child_name as assignment_child_name
       FROM tournament_slots s
       JOIN duty_types dt ON dt.id = s.duty_type_id
       LEFT JOIN assignments a ON a.slot_id = s.id
       LEFT JOIN parents p ON p.id = a.parent_id
       WHERE s.tournament_id = ?
       ORDER BY dt.sort_order ASC, s.sort_order ASC`
    )
    .bind(tournamentId)
    .all<SlotJoinRow>();

  return results.map((row) => ({
    id: row.id,
    label: row.label,
    sortOrder: row.sort_order,
    dutyTypeId: row.duty_type_id,
    dutyTypeName: row.duty_type_name,
    assignment: row.assignment_parent_id
      ? {
          parentId: row.assignment_parent_id,
          parentName: parentDisplayName({
            firstName: row.assignment_first_name as string,
            lastName: row.assignment_last_name as string,
            childName: row.assignment_child_name,
          }),
        }
      : null,
  }));
}

export async function getTournamentDetail(db: D1Database, id: string): Promise<TournamentDetail | null> {
  const tournament = await getTournament(db, id);
  if (!tournament) return null;
  const slots = await slotsWithAssignments(db, id);
  return { ...tournament, slots };
}

export async function listPublicTournaments(db: D1Database): Promise<TournamentDetail[]> {
  const tournaments = await listTournaments(db);
  const detailed = await Promise.all(
    tournaments.map(async (t) => ({ ...t, slots: await slotsWithAssignments(db, t.id) }))
  );
  return detailed;
}

// --- Dienst-Slots ------------------------------------------------------------

export async function createSlot(
  db: D1Database,
  input: { tournamentId: string; dutyTypeId: string; label: string | null; sortOrder: number }
): Promise<Slot> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO tournament_slots (id, tournament_id, duty_type_id, label, sort_order) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, input.tournamentId, input.dutyTypeId, input.label, input.sortOrder)
    .run();
  const row = await db.prepare("SELECT * FROM tournament_slots WHERE id = ?").bind(id).first<SlotRow>();
  return rowToSlot(row as SlotRow);
}

export async function getSlot(db: D1Database, id: string): Promise<Slot | null> {
  const row = await db.prepare("SELECT * FROM tournament_slots WHERE id = ?").bind(id).first<SlotRow>();
  return row ? rowToSlot(row) : null;
}

export async function updateSlot(
  db: D1Database,
  id: string,
  input: { dutyTypeId: string; label: string | null; sortOrder: number }
): Promise<Slot | null> {
  await db
    .prepare("UPDATE tournament_slots SET duty_type_id = ?, label = ?, sort_order = ? WHERE id = ?")
    .bind(input.dutyTypeId, input.label, input.sortOrder, id)
    .run();
  const row = await db.prepare("SELECT * FROM tournament_slots WHERE id = ?").bind(id).first<SlotRow>();
  return row ? rowToSlot(row) : null;
}

export async function deleteSlot(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM tournament_slots WHERE id = ?").bind(id).run();
}

// --- Zuteilungen -------------------------------------------------------------

export type AssignResult =
  | { ok: true; assignment: Assignment }
  | { ok: false; reason: "slot_not_found" }
  | { ok: false; reason: "parent_not_found" }
  | { ok: false; reason: "already_assigned_in_tournament"; existingSlotId: string };

export async function assignParentToSlot(
  db: D1Database,
  slotId: string,
  parentId: string
): Promise<AssignResult> {
  const slot = await db
    .prepare("SELECT * FROM tournament_slots WHERE id = ?")
    .bind(slotId)
    .first<SlotRow>();
  if (!slot) return { ok: false, reason: "slot_not_found" };

  const parent = await db.prepare("SELECT id FROM parents WHERE id = ?").bind(parentId).first();
  if (!parent) return { ok: false, reason: "parent_not_found" };

  const conflict = await db
    .prepare("SELECT slot_id FROM assignments WHERE tournament_id = ? AND parent_id = ? AND slot_id != ?")
    .bind(slot.tournament_id, parentId, slotId)
    .first<{ slot_id: string }>();
  if (conflict) return { ok: false, reason: "already_assigned_in_tournament", existingSlotId: conflict.slot_id };

  const existing = await db
    .prepare("SELECT * FROM assignments WHERE slot_id = ?")
    .bind(slotId)
    .first<AssignmentRow>();

  if (existing) {
    await db.prepare("UPDATE assignments SET parent_id = ? WHERE slot_id = ?").bind(parentId, slotId).run();
  } else {
    await db
      .prepare("INSERT INTO assignments (id, slot_id, tournament_id, parent_id) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), slotId, slot.tournament_id, parentId)
      .run();
  }
  const row = await db
    .prepare("SELECT * FROM assignments WHERE slot_id = ?")
    .bind(slotId)
    .first<AssignmentRow>();
  return { ok: true, assignment: rowToAssignment(row as AssignmentRow) };
}

export async function unassignSlot(db: D1Database, slotId: string): Promise<void> {
  await db.prepare("DELETE FROM assignments WHERE slot_id = ?").bind(slotId).run();
}

// --- Fairness / Auslastung ----------------------------------------------------

export async function getFairnessOverview(db: D1Database): Promise<FairnessRow[]> {
  const parents = await listParents(db);
  const { results } = await db
    .prepare(
      `SELECT a.parent_id as parent_id, a.tournament_id as tournament_id, s.duty_type_id as duty_type_id
       FROM assignments a
       JOIN tournament_slots s ON s.id = a.slot_id`
    )
    .all<{ parent_id: string; tournament_id: string; duty_type_id: string }>();

  const byParent = new Map<string, { total: number; byDutyType: Record<string, number> }>();
  for (const row of results) {
    const entry = byParent.get(row.parent_id) ?? { total: 0, byDutyType: {} };
    entry.total += 1;
    entry.byDutyType[row.duty_type_id] = (entry.byDutyType[row.duty_type_id] ?? 0) + 1;
    byParent.set(row.parent_id, entry);
  }

  return parents.map((p) => {
    const entry = byParent.get(p.id) ?? { total: 0, byDutyType: {} };
    return {
      parentId: p.id,
      parentName: parentDisplayName(p),
      active: p.active,
      total: entry.total,
      byDutyType: entry.byDutyType,
    };
  });
}

/**
 * Verteilt offene Slots eines Turniers fair unter aktiven Eltern:
 * - ein Elternteil wird nie zweimal am selben Turnier eingeteilt
 *   (bereits vergebene Slots blockieren die zugehörigen Eltern),
 * - unter den verbleibenden Eltern wird zunächst nach der bisherigen
 *   Häufigkeit *dieses* Dienst-Typs sortiert, dann nach der Gesamtzahl
 *   aller bisherigen Dienste, mit zufälligem Losentscheid bei Gleichstand.
 */
export async function autoAssignTournament(
  db: D1Database,
  tournamentId: string
): Promise<{ assigned: number; unfilled: string[] }> {
  const detail = await getTournamentDetail(db, tournamentId);
  if (!detail) return { assigned: 0, unfilled: [] };

  const openSlots = detail.slots.filter((s) => !s.assignment);
  if (openSlots.length === 0) return { assigned: 0, unfilled: [] };

  const parents = (await listParents(db)).filter((p) => p.active);
  const fairness = await getFairnessOverview(db);
  const loadByParent = new Map(fairness.map((f) => [f.parentId, f]));

  const usedThisTournament = new Set(
    detail.slots.filter((s) => s.assignment).map((s) => s.assignment!.parentId)
  );

  let assigned = 0;
  const unfilled: string[] = [];

  for (const slot of openSlots) {
    const candidates = parents.filter((p) => !usedThisTournament.has(p.id));
    if (candidates.length === 0) {
      unfilled.push(slot.id);
      continue;
    }

    const scored = candidates
      .map((p) => {
        const load = loadByParent.get(p.id);
        return {
          parent: p,
          byDutyType: load?.byDutyType[slot.dutyTypeId] ?? 0,
          total: load?.total ?? 0,
          jitter: Math.random(),
        };
      })
      .sort((a, b) => a.byDutyType - b.byDutyType || a.total - b.total || a.jitter - b.jitter);

    const chosen = scored[0].parent;
    await assignParentToSlot(db, slot.id, chosen.id);
    usedThisTournament.add(chosen.id);
    const load = loadByParent.get(chosen.id) ?? { parentId: chosen.id, parentName: "", active: true, total: 0, byDutyType: {} };
    load.total += 1;
    load.byDutyType[slot.dutyTypeId] = (load.byDutyType[slot.dutyTypeId] ?? 0) + 1;
    loadByParent.set(chosen.id, load);
    assigned += 1;
  }

  return { assigned, unfilled };
}
