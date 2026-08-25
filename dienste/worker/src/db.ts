import type {
  Assignment,
  AssignmentRow,
  DutyType,
  DutyTypeRow,
  FairnessRow,
  InventoryItem,
  InventoryItemRow,
  Jugend,
  JugendRow,
  Parent,
  ParentAssignmentHistoryEntry,
  ParentRow,
  Player,
  PlayerRow,
  Role,
  Slot,
  SlotRow,
  SlotWithAssignment,
  Tournament,
  TournamentDetail,
  TournamentRow,
  User,
  UserRow,
  UserWithJugenden,
} from "./types";

function rowToUser(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.created_at };
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

function rowToInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    minQuantity: row.min_quantity,
    maxQuantity: row.max_quantity,
    note: row.note,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function playerFullName(firstName: string | null, lastName: string | null): string | null {
  return firstName && lastName ? `${firstName} ${lastName}` : null;
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
    playerId: row.player_id,
    playerName: playerFullName(row.player_first_name, row.player_last_name),
    roleLabel: row.role_label,
    jugendId: row.jugend_id,
    jugendName: row.jugend_name,
    createdAt: row.created_at,
  };
}

function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    jugendId: row.jugend_id,
    jugendName: row.jugend_name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    eventDate: row.event_date,
    eventTime: row.event_time,
    location: row.location,
    notes: row.notes,
    jugendId: row.jugend_id,
    jugendName: row.jugend_name,
    createdAt: row.created_at,
  };
}

function rowToJugend(row: JugendRow): Jugend {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToSlot(row: SlotRow): Slot {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    dutyTypeId: row.duty_type_id,
    label: row.label,
    time: row.time,
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
    status: row.status,
  };
}

export function parentDisplayName(p: { playerName: string | null; roleLabel?: string | null }): string {
  if (!p.playerName) return "Eltern (kein Spieler zugeordnet)";
  const base = `Eltern von ${p.playerName}`;
  return p.roleLabel ? `${base} (${p.roleLabel})` : base;
}

// --- Nutzer ---------------------------------------------------------------

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function listTrainerJugendIds(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT jugend_id FROM trainer_jugenden WHERE user_id = ?")
    .bind(userId)
    .all<{ jugend_id: string }>();
  return results.map((r) => r.jugend_id);
}

export async function setTrainerJugenden(db: D1Database, userId: string, jugendIds: string[]): Promise<void> {
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM trainer_jugenden WHERE user_id = ?").bind(userId),
  ];
  for (const jugendId of jugendIds) {
    statements.push(
      db.prepare("INSERT INTO trainer_jugenden (user_id, jugend_id) VALUES (?, ?)").bind(userId, jugendId)
    );
  }
  await db.batch(statements);
}

export async function listUsers(db: D1Database): Promise<UserWithJugenden[]> {
  const { results: userRows } = await db
    .prepare("SELECT * FROM users ORDER BY email ASC")
    .all<UserRow>();
  const { results: assignmentRows } = await db
    .prepare("SELECT user_id, jugend_id FROM trainer_jugenden")
    .all<{ user_id: string; jugend_id: string }>();
  const jugendIdsByUser = new Map<string, string[]>();
  for (const row of assignmentRows) {
    const list = jugendIdsByUser.get(row.user_id) ?? [];
    list.push(row.jugend_id);
    jugendIdsByUser.set(row.user_id, list);
  }
  return userRows.map((row) => ({ ...rowToUser(row), jugendIds: jugendIdsByUser.get(row.id) ?? [] }));
}

export async function createUser(
  db: D1Database,
  input: { email: string; name: string | null; passwordHash: string; passwordSalt: string; role: Role }
): Promise<User> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO users (id, email, name, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id, input.email, input.name, input.passwordHash, input.passwordSalt, input.role)
    .run();
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  return rowToUser(row as UserRow);
}

export async function updateUser(
  db: D1Database,
  id: string,
  input: { name: string | null; role: Role; passwordHash?: string; passwordSalt?: string }
): Promise<User | null> {
  if (input.passwordHash && input.passwordSalt) {
    await db
      .prepare("UPDATE users SET name = ?, role = ?, password_hash = ?, password_salt = ? WHERE id = ?")
      .bind(input.name, input.role, input.passwordHash, input.passwordSalt, id)
      .run();
  } else {
    await db.prepare("UPDATE users SET name = ?, role = ? WHERE id = ?").bind(input.name, input.role, id).run();
  }
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function deleteUser(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
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

// --- Lagerbestand --------------------------------------------------------------

export async function listInventoryItems(db: D1Database): Promise<InventoryItem[]> {
  const { results } = await db
    .prepare("SELECT * FROM inventory_items ORDER BY sort_order ASC, name ASC")
    .all<InventoryItemRow>();
  return results.map(rowToInventoryItem);
}

export async function createInventoryItem(
  db: D1Database,
  input: {
    name: string;
    unit: string | null;
    quantity: number;
    minQuantity: number;
    maxQuantity: number | null;
    note: string | null;
    sortOrder: number;
  }
): Promise<InventoryItem> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO inventory_items (id, name, unit, quantity, min_quantity, max_quantity, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, input.name, input.unit, input.quantity, input.minQuantity, input.maxQuantity, input.note, input.sortOrder)
    .run();
  const row = await db.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first<InventoryItemRow>();
  return rowToInventoryItem(row as InventoryItemRow);
}

export async function updateInventoryItem(
  db: D1Database,
  id: string,
  input: {
    name: string;
    unit: string | null;
    quantity: number;
    minQuantity: number;
    maxQuantity: number | null;
    note: string | null;
    sortOrder: number;
  }
): Promise<InventoryItem | null> {
  await db
    .prepare(
      "UPDATE inventory_items SET name = ?, unit = ?, quantity = ?, min_quantity = ?, max_quantity = ?, note = ?, sort_order = ? WHERE id = ?"
    )
    .bind(
      input.name,
      input.unit,
      input.quantity,
      input.minQuantity,
      input.maxQuantity,
      input.note,
      input.sortOrder,
      id
    )
    .run();
  const row = await db.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first<InventoryItemRow>();
  return row ? rowToInventoryItem(row) : null;
}

export async function deleteInventoryItem(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM inventory_items WHERE id = ?").bind(id).run();
}

// --- Jugenden ----------------------------------------------------------------

export async function listJugenden(db: D1Database): Promise<Jugend[]> {
  const { results } = await db
    .prepare("SELECT * FROM jugenden ORDER BY sort_order ASC, name ASC")
    .all<JugendRow>();
  return results.map(rowToJugend);
}

export async function createJugend(
  db: D1Database,
  input: { name: string; sortOrder: number }
): Promise<Jugend> {
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO jugenden (id, name, sort_order) VALUES (?, ?, ?)")
    .bind(id, input.name, input.sortOrder)
    .run();
  const row = await db.prepare("SELECT * FROM jugenden WHERE id = ?").bind(id).first<JugendRow>();
  return rowToJugend(row as JugendRow);
}

export async function updateJugend(
  db: D1Database,
  id: string,
  input: { name: string; sortOrder: number }
): Promise<Jugend | null> {
  await db
    .prepare("UPDATE jugenden SET name = ?, sort_order = ? WHERE id = ?")
    .bind(input.name, input.sortOrder, id)
    .run();
  const row = await db.prepare("SELECT * FROM jugenden WHERE id = ?").bind(id).first<JugendRow>();
  return row ? rowToJugend(row) : null;
}

export async function deleteJugend(db: D1Database, id: string): Promise<{ ok: boolean; inUse: boolean }> {
  const usedByParent = await db.prepare("SELECT 1 FROM parents WHERE jugend_id = ? LIMIT 1").bind(id).first();
  if (usedByParent) return { ok: false, inUse: true };
  const usedByTournament = await db
    .prepare("SELECT 1 FROM tournaments WHERE jugend_id = ? LIMIT 1")
    .bind(id)
    .first();
  if (usedByTournament) return { ok: false, inUse: true };
  const usedByPlayer = await db.prepare("SELECT 1 FROM players WHERE jugend_id = ? LIMIT 1").bind(id).first();
  if (usedByPlayer) return { ok: false, inUse: true };
  await db.prepare("DELETE FROM jugenden WHERE id = ?").bind(id).run();
  return { ok: true, inUse: false };
}

// --- Spieler -------------------------------------------------------------

const PLAYER_SELECT = `SELECT pl.*, j.name as jugend_name FROM players pl LEFT JOIN jugenden j ON j.id = pl.jugend_id`;

export async function listPlayers(db: D1Database): Promise<Player[]> {
  const { results } = await db
    .prepare(`${PLAYER_SELECT} ORDER BY pl.sort_order ASC, pl.last_name ASC, pl.first_name ASC`)
    .all<PlayerRow>();
  return results.map(rowToPlayer);
}

export async function getPlayer(db: D1Database, id: string): Promise<Player | null> {
  const row = await db.prepare(`${PLAYER_SELECT} WHERE pl.id = ?`).bind(id).first<PlayerRow>();
  return row ? rowToPlayer(row) : null;
}

export async function createPlayer(
  db: D1Database,
  input: { firstName: string; lastName: string; jugendId: string; sortOrder: number }
): Promise<Player> {
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO players (id, first_name, last_name, jugend_id, sort_order) VALUES (?, ?, ?, ?, ?)")
    .bind(id, input.firstName, input.lastName, input.jugendId, input.sortOrder)
    .run();
  const row = await db.prepare(`${PLAYER_SELECT} WHERE pl.id = ?`).bind(id).first<PlayerRow>();
  return rowToPlayer(row as PlayerRow);
}

export async function updatePlayer(
  db: D1Database,
  id: string,
  input: { firstName: string; lastName: string; jugendId: string; sortOrder: number }
): Promise<Player | null> {
  await db
    .prepare("UPDATE players SET first_name = ?, last_name = ?, jugend_id = ?, sort_order = ? WHERE id = ?")
    .bind(input.firstName, input.lastName, input.jugendId, input.sortOrder, id)
    .run();
  const row = await db.prepare(`${PLAYER_SELECT} WHERE pl.id = ?`).bind(id).first<PlayerRow>();
  return row ? rowToPlayer(row) : null;
}

export async function deletePlayer(db: D1Database, id: string): Promise<{ ok: boolean; inUse: boolean }> {
  const used = await db.prepare("SELECT 1 FROM parents WHERE player_id = ? LIMIT 1").bind(id).first();
  if (used) return { ok: false, inUse: true };
  await db.prepare("DELETE FROM players WHERE id = ?").bind(id).run();
  return { ok: true, inUse: false };
}

// --- Eltern ----------------------------------------------------------------

const PARENT_SELECT = `SELECT
    p.id as id,
    p.first_name as first_name,
    p.last_name as last_name,
    p.child_name as child_name,
    p.email as email,
    p.phone as phone,
    p.notes as notes,
    p.active as active,
    p.player_id as player_id,
    p.role_label as role_label,
    p.created_at as created_at,
    pl.first_name as player_first_name,
    pl.last_name as player_last_name,
    pl.jugend_id as jugend_id,
    j.name as jugend_name
  FROM parents p
  LEFT JOIN players pl ON pl.id = p.player_id
  LEFT JOIN jugenden j ON j.id = pl.jugend_id`;

export async function listParents(db: D1Database): Promise<Parent[]> {
  const { results } = await db
    .prepare(`${PARENT_SELECT} ORDER BY p.last_name ASC, p.first_name ASC`)
    .all<ParentRow>();
  return results.map(rowToParent);
}

async function getParentRow(db: D1Database, id: string): Promise<ParentRow | null> {
  const row = await db.prepare(`${PARENT_SELECT} WHERE p.id = ?`).bind(id).first<ParentRow>();
  return row ?? null;
}

export async function getParent(db: D1Database, id: string): Promise<Parent | null> {
  const row = await getParentRow(db, id);
  return row ? rowToParent(row) : null;
}

interface ParentHistoryJoinRow {
  assignment_id: string;
  tournament_id: string;
  tournament_name: string;
  event_date: string;
  event_time: string | null;
  duty_type_name: string;
  label: string | null;
  slot_time: string | null;
  status: "confirmed" | "pending";
}

export async function getParentAssignmentHistory(
  db: D1Database,
  parentId: string
): Promise<ParentAssignmentHistoryEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT
         a.id as assignment_id,
         t.id as tournament_id,
         t.name as tournament_name,
         t.event_date as event_date,
         t.event_time as event_time,
         dt.name as duty_type_name,
         s.label as label,
         s.time as slot_time,
         a.status as status
       FROM assignments a
       JOIN tournament_slots s ON s.id = a.slot_id
       JOIN tournaments t ON t.id = a.tournament_id
       JOIN duty_types dt ON dt.id = s.duty_type_id
       WHERE a.parent_id = ?
       ORDER BY t.event_date ASC, t.event_time ASC`
    )
    .bind(parentId)
    .all<ParentHistoryJoinRow>();

  return results.map((row) => ({
    assignmentId: row.assignment_id,
    tournamentId: row.tournament_id,
    tournamentName: row.tournament_name,
    eventDate: row.event_date,
    eventTime: row.event_time,
    dutyTypeName: row.duty_type_name,
    label: row.label,
    slotTime: row.slot_time,
    status: row.status,
  }));
}

export async function createParent(
  db: D1Database,
  input: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    active: boolean;
    playerId: string;
    roleLabel: string | null;
  }
): Promise<Parent> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO parents (id, first_name, last_name, email, phone, notes, active, player_id, role_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      id,
      input.firstName,
      input.lastName,
      input.email,
      input.phone,
      input.notes,
      input.active ? 1 : 0,
      input.playerId,
      input.roleLabel
    )
    .run();
  const row = await getParentRow(db, id);
  return rowToParent(row as ParentRow);
}

export async function updateParent(
  db: D1Database,
  id: string,
  input: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    active: boolean;
    playerId: string;
    roleLabel: string | null;
  }
): Promise<Parent | null> {
  await db
    .prepare(
      "UPDATE parents SET first_name = ?, last_name = ?, email = ?, phone = ?, notes = ?, active = ?, player_id = ?, role_label = ? WHERE id = ?"
    )
    .bind(
      input.firstName,
      input.lastName,
      input.email,
      input.phone,
      input.notes,
      input.active ? 1 : 0,
      input.playerId,
      input.roleLabel,
      id
    )
    .run();
  const row = await getParentRow(db, id);
  return row ? rowToParent(row) : null;
}

export async function deleteParent(db: D1Database, id: string): Promise<{ ok: boolean; inUse: boolean }> {
  const used = await db.prepare("SELECT 1 FROM assignments WHERE parent_id = ? LIMIT 1").bind(id).first();
  if (used) return { ok: false, inUse: true };
  await db.prepare("DELETE FROM parents WHERE id = ?").bind(id).run();
  return { ok: true, inUse: false };
}

// --- Turniere ----------------------------------------------------------------

const TOURNAMENT_SELECT = `SELECT t.*, j.name as jugend_name FROM tournaments t LEFT JOIN jugenden j ON j.id = t.jugend_id`;

export async function listTournaments(db: D1Database): Promise<Tournament[]> {
  const { results } = await db
    .prepare(`${TOURNAMENT_SELECT} ORDER BY t.event_date ASC`)
    .all<TournamentRow>();
  return results.map(rowToTournament);
}

export async function createTournament(
  db: D1Database,
  input: {
    name: string;
    type: string;
    eventDate: string;
    eventTime: string | null;
    location: string | null;
    notes: string | null;
    jugendId: string | null;
  }
): Promise<Tournament> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO tournaments (id, name, type, event_date, event_time, location, notes, jugend_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, input.name, input.type, input.eventDate, input.eventTime, input.location, input.notes, input.jugendId)
    .run();
  const row = await db.prepare(`${TOURNAMENT_SELECT} WHERE t.id = ?`).bind(id).first<TournamentRow>();
  return rowToTournament(row as TournamentRow);
}

export async function updateTournament(
  db: D1Database,
  id: string,
  input: {
    name: string;
    type: string;
    eventDate: string;
    eventTime: string | null;
    location: string | null;
    notes: string | null;
    jugendId: string | null;
  }
): Promise<Tournament | null> {
  await db
    .prepare(
      "UPDATE tournaments SET name = ?, type = ?, event_date = ?, event_time = ?, location = ?, notes = ?, jugend_id = ? WHERE id = ?"
    )
    .bind(
      input.name,
      input.type,
      input.eventDate,
      input.eventTime,
      input.location,
      input.notes,
      input.jugendId,
      id
    )
    .run();
  const row = await db.prepare(`${TOURNAMENT_SELECT} WHERE t.id = ?`).bind(id).first<TournamentRow>();
  return row ? rowToTournament(row) : null;
}

export async function deleteTournament(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM tournaments WHERE id = ?").bind(id).run();
}

export async function getTournament(db: D1Database, id: string): Promise<Tournament | null> {
  const row = await db.prepare(`${TOURNAMENT_SELECT} WHERE t.id = ?`).bind(id).first<TournamentRow>();
  return row ? rowToTournament(row) : null;
}

interface SlotJoinRow {
  id: string;
  label: string | null;
  time: string | null;
  sort_order: number;
  duty_type_id: string;
  duty_type_name: string;
  assignment_parent_id: string | null;
  assignment_player_first_name: string | null;
  assignment_player_last_name: string | null;
  assignment_role_label: string | null;
  assignment_status: "confirmed" | "pending" | null;
  assignment_note: string | null;
}

async function slotsWithAssignments(db: D1Database, tournamentId: string): Promise<SlotWithAssignment[]> {
  const { results } = await db
    .prepare(
      `SELECT
         s.id as id,
         s.label as label,
         s.time as time,
         s.sort_order as sort_order,
         s.duty_type_id as duty_type_id,
         dt.name as duty_type_name,
         p.id as assignment_parent_id,
         pl.first_name as assignment_player_first_name,
         pl.last_name as assignment_player_last_name,
         p.role_label as assignment_role_label,
         a.status as assignment_status,
         a.note as assignment_note
       FROM tournament_slots s
       JOIN duty_types dt ON dt.id = s.duty_type_id
       LEFT JOIN assignments a ON a.slot_id = s.id
       LEFT JOIN parents p ON p.id = a.parent_id
       LEFT JOIN players pl ON pl.id = p.player_id
       WHERE s.tournament_id = ?
       ORDER BY dt.sort_order ASC, s.sort_order ASC`
    )
    .bind(tournamentId)
    .all<SlotJoinRow>();

  return results.map((row) => ({
    id: row.id,
    label: row.label,
    time: row.time,
    sortOrder: row.sort_order,
    dutyTypeId: row.duty_type_id,
    dutyTypeName: row.duty_type_name,
    assignment: row.assignment_parent_id
      ? {
          parentId: row.assignment_parent_id,
          parentName: parentDisplayName({
            playerName: playerFullName(row.assignment_player_first_name, row.assignment_player_last_name),
            roleLabel: row.assignment_role_label,
          }),
          status: row.assignment_status ?? "confirmed",
          note: row.assignment_note,
        }
      : null,
  }));
}

export async function listAvailablePlayerIds(db: D1Database, tournamentId: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT player_id FROM tournament_players WHERE tournament_id = ?")
    .bind(tournamentId)
    .all<{ player_id: string }>();
  return results.map((r) => r.player_id);
}

export async function setAvailablePlayers(db: D1Database, tournamentId: string, playerIds: string[]): Promise<void> {
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM tournament_players WHERE tournament_id = ?").bind(tournamentId),
  ];
  for (const playerId of playerIds) {
    statements.push(
      db
        .prepare("INSERT INTO tournament_players (tournament_id, player_id) VALUES (?, ?)")
        .bind(tournamentId, playerId)
    );
  }
  await db.batch(statements);
}

export async function getTournamentDetail(db: D1Database, id: string): Promise<TournamentDetail | null> {
  const tournament = await getTournament(db, id);
  if (!tournament) return null;
  const slots = await slotsWithAssignments(db, id);
  const availablePlayerIds = await listAvailablePlayerIds(db, id);
  return { ...tournament, slots, availablePlayerIds };
}

// --- Dienst-Slots ------------------------------------------------------------

export async function createSlot(
  db: D1Database,
  input: { tournamentId: string; dutyTypeId: string; label: string | null; time: string | null; sortOrder: number }
): Promise<Slot> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO tournament_slots (id, tournament_id, duty_type_id, label, time, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id, input.tournamentId, input.dutyTypeId, input.label, input.time, input.sortOrder)
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
  input: { dutyTypeId: string; label: string | null; time: string | null; sortOrder: number }
): Promise<Slot | null> {
  await db
    .prepare("UPDATE tournament_slots SET duty_type_id = ?, label = ?, time = ?, sort_order = ? WHERE id = ?")
    .bind(input.dutyTypeId, input.label, input.time, input.sortOrder, id)
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
  parentId: string,
  opts?: { status?: "confirmed" | "pending"; note?: string | null }
): Promise<AssignResult> {
  const status = opts?.status ?? "confirmed";
  const note = opts?.note ?? null;

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
    await db
      .prepare("UPDATE assignments SET parent_id = ?, status = ?, note = ? WHERE slot_id = ?")
      .bind(parentId, status, note, slotId)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO assignments (id, slot_id, tournament_id, parent_id, status, note) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(crypto.randomUUID(), slotId, slot.tournament_id, parentId, status, note)
      .run();
  }
  const row = await db
    .prepare("SELECT * FROM assignments WHERE slot_id = ?")
    .bind(slotId)
    .first<AssignmentRow>();
  return { ok: true, assignment: rowToAssignment(row as AssignmentRow) };
}

export async function confirmSlotAssignment(db: D1Database, slotId: string): Promise<{ ok: boolean }> {
  const result = await db.prepare("UPDATE assignments SET status = 'confirmed' WHERE slot_id = ?").bind(slotId).run();
  return { ok: (result.meta?.changes ?? 0) > 0 };
}

export async function unassignSlot(db: D1Database, slotId: string): Promise<void> {
  await db.prepare("DELETE FROM assignments WHERE slot_id = ?").bind(slotId).run();
}

export type SwapResult =
  | { ok: true }
  | { ok: false; reason: "not_assigned" | "different_tournament" | "same_parent" };

// Tauscht die Zuteilungen zweier Slots desselben Turniers (z.B. Grillen und
// Bonkasse). Löscht zuerst beide Zuteilungen und legt sie mit vertauschtem
// Elternteil neu an, statt sie per UPDATE zu überschreiben - sonst würde die
// UNIQUE(tournament_id, parent_id)-Regel kurzzeitig verletzt (beide Slots
// hätten für einen Moment dasselbe Elternteil).
export async function swapSlotAssignments(db: D1Database, slotIdA: string, slotIdB: string): Promise<SwapResult> {
  const rowA = await db.prepare("SELECT * FROM assignments WHERE slot_id = ?").bind(slotIdA).first<AssignmentRow>();
  const rowB = await db.prepare("SELECT * FROM assignments WHERE slot_id = ?").bind(slotIdB).first<AssignmentRow>();
  if (!rowA || !rowB) return { ok: false, reason: "not_assigned" };
  if (rowA.tournament_id !== rowB.tournament_id) return { ok: false, reason: "different_tournament" };
  if (rowA.parent_id === rowB.parent_id) return { ok: false, reason: "same_parent" };

  await db.batch([
    db.prepare("DELETE FROM assignments WHERE id IN (?, ?)").bind(rowA.id, rowB.id),
    db
      .prepare(
        "INSERT INTO assignments (id, slot_id, tournament_id, parent_id, status, note) VALUES (?, ?, ?, ?, 'confirmed', ?)"
      )
      .bind(crypto.randomUUID(), slotIdA, rowA.tournament_id, rowB.parent_id, rowB.note),
    db
      .prepare(
        "INSERT INTO assignments (id, slot_id, tournament_id, parent_id, status, note) VALUES (?, ?, ?, ?, 'confirmed', ?)"
      )
      .bind(crypto.randomUUID(), slotIdB, rowB.tournament_id, rowA.parent_id, rowA.note),
  ]);
  return { ok: true };
}

// --- Fairness / Auslastung ----------------------------------------------------

export async function getFairnessOverview(
  db: D1Database,
  allowedJugendIds?: string[] | null
): Promise<FairnessRow[]> {
  const allParents = await listParents(db);
  const parents = allowedJugendIds
    ? allParents.filter((p) => p.jugendId !== null && allowedJugendIds.includes(p.jugendId))
    : allParents;
  // Ein Dienst zählt erst als "gemacht", wenn das Turnier (mit einem Tag
  // Puffer) tatsächlich stattgefunden hat - direkt nach der Zuteilung wäre
  // die Anzeige sonst irreführend (Dienst noch nicht geleistet, ggf. sogar
  // noch getauscht).
  const { results } = await db
    .prepare(
      `SELECT a.parent_id as parent_id, a.tournament_id as tournament_id, s.duty_type_id as duty_type_id
       FROM assignments a
       JOIN tournament_slots s ON s.id = a.slot_id
       JOIN tournaments t ON t.id = a.tournament_id
       WHERE a.status = 'confirmed' AND date(t.event_date, '+1 day') <= date('now')`
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
      jugendId: p.jugendId,
      total: entry.total,
      byDutyType: entry.byDutyType,
    };
  });
}

/**
 * Verteilt offene Slots eines Turniers fair unter aktiven Eltern:
 * - ein Elternteil wird nie zweimal am selben Turnier eingeteilt
 *   (bereits vergebene Slots blockieren die zugehörigen Eltern),
 * - ist eine Liste verfügbarer Spieler für das Turnier hinterlegt, kommen
 *   nur deren Eltern infrage (leere Liste = keine Einschränkung),
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

  const parents = (await listParents(db)).filter(
    (p) =>
      p.active &&
      (!detail.jugendId || p.jugendId === detail.jugendId) &&
      (detail.availablePlayerIds.length === 0 ||
        (p.playerId !== null && detail.availablePlayerIds.includes(p.playerId)))
  );
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
    const load = loadByParent.get(chosen.id) ?? {
      parentId: chosen.id,
      parentName: "",
      active: true,
      jugendId: chosen.jugendId,
      total: 0,
      byDutyType: {},
    };
    load.total += 1;
    load.byDutyType[slot.dutyTypeId] = (load.byDutyType[slot.dutyTypeId] ?? 0) + 1;
    loadByParent.set(chosen.id, load);
    assigned += 1;
  }

  return { assigned, unfilled };
}
