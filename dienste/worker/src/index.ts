import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context, MiddlewareHandler } from "hono";
import * as db from "./db";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./auth";
import { canAccessJugend } from "./authz";
import {
  normalizedEmail,
  optionalEmail,
  optionalId,
  optionalText,
  requiredText,
  validBool,
  validDate,
  validEnum,
  validId,
  validCount,
  validOptionalCount,
  validPassword,
  validSortOrder,
  validTime,
} from "./validation";
import type { Env, Role } from "./types";

type Variables = {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  jugendIds: string[];
};

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

const APPLIES_TO = ["home", "away", "both"] as const;
const TOURNAMENT_TYPE = ["home", "away"] as const;
const CASH_TRANSACTION_KIND = ["income", "expense"] as const;
const CASH_TRANSACTION_CATEGORY = ["sales", "drinks", "grill", "supplies", "gas", "equipment", "other"] as const;
const ROLES = ["admin", "trainer"] as const;

app.use("*", async (c, next) =>
  cors({
    origin: (origin, context) => {
      if (!origin) return null;
      if (origin === new URL(context.env.FRONTEND_URL).origin) return origin;
      const apiHostname = new URL(context.req.url).hostname;
      const isLocalApi = apiHostname === "localhost" || apiHostname === "127.0.0.1";
      const isLocalFrontend = /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin);
      return isLocalApi && isLocalFrontend ? origin : null;
    },
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })(c, next)
);

app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  await next();
});

const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return c.json({ error: "Nicht angemeldet" }, 401);
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    const user = await db.getUserById(c.env.DB, payload.sub);
    if (!user) return c.json({ error: "Nicht angemeldet" }, 401);
    c.set("userId", user.id);
    c.set("email", user.email);
    c.set("name", user.name);
    c.set("role", user.role);
    c.set("jugendIds", user.role === "trainer" ? await db.listTrainerJugendIds(c.env.DB, user.id) : []);
  } catch {
    return c.json({ error: "Nicht angemeldet" }, 401);
  }
  await next();
};

const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("role") !== "admin") return c.json({ error: "Nur für Admins" }, 403);
  await next();
};

function forbiddenJugend(c: Context<AppEnv>) {
  return c.json({ error: "Keine Berechtigung für diese Jugend" }, 403);
}

// Lädt das Turnier zu einem Dienst-Slot - Grundlage für die
// Jugend-Berechtigungsprüfung bei allen Slot-/Zuteilungs-Routen.
async function getTournamentForSlot(dbEnv: D1Database, slotId: string) {
  const slot = await db.getSlot(dbEnv, slotId);
  if (!slot) return null;
  return db.getTournament(dbEnv, slot.tournamentId);
}

app.post("/api/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = normalizedEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : undefined;
  if (!email || !password) return c.json({ error: "E-Mail oder Passwort fehlt" }, 400);

  const userRow = await db.getUserByEmail(c.env.DB, email);
  if (!userRow) return c.json({ error: "E-Mail oder Passwort ungültig" }, 401);

  const valid = await verifyPassword(password, userRow.password_hash, userRow.password_salt);
  if (!valid) return c.json({ error: "E-Mail oder Passwort ungültig" }, 401);

  const token = await signToken(
    { sub: userRow.id, email: userRow.email, name: userRow.name },
    c.env.JWT_SECRET
  );
  return c.json({
    token,
    user: { id: userRow.id, email: userRow.email, name: userRow.name, role: userRow.role },
  });
});

app.get("/api/me", requireAuth, async (c) => {
  return c.json({
    id: c.get("userId"),
    email: c.get("email"),
    name: c.get("name"),
    role: c.get("role"),
    jugendIds: c.get("jugendIds"),
  });
});

// --- Dienst-Typen ------------------------------------------------------------
// Globaler, geteilter Katalog: alle Rollen dürfen lesen, nur Admins pflegen.

app.get("/api/duty-types", requireAuth, async (c) => {
  return c.json(await db.listDutyTypes(c.env.DB));
});

app.post("/api/duty-types", requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 100);
  const appliesTo = validEnum(body?.appliesTo, APPLIES_TO);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (!appliesTo) return c.json({ error: "Turnierart ist ungültig" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const dutyType = await db.createDutyType(c.env.DB, { name, appliesTo, sortOrder });
  return c.json(dutyType, 201);
});

app.put("/api/duty-types/:id", requireAuth, requireAdmin, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 100);
  const appliesTo = validEnum(body?.appliesTo, APPLIES_TO);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (!appliesTo) return c.json({ error: "Turnierart ist ungültig" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const dutyType = await db.updateDutyType(c.env.DB, id, { name, appliesTo, sortOrder });
  if (!dutyType) return c.json({ error: "Dienst-Typ nicht gefunden" }, 404);
  return c.json(dutyType);
});

app.delete("/api/duty-types/:id", requireAuth, requireAdmin, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const result = await db.deleteDutyType(c.env.DB, id);
  if (result.inUse) return c.json({ error: "Dienst-Typ wird noch bei Turnieren verwendet" }, 409);
  return c.body(null, 204);
});

// --- Lagerbestand --------------------------------------------------------------
// Artikel sind einer Jugend zugeordnet. Vereinsweite Altbestände ohne Jugend
// bleiben für Admins sichtbar; Trainer pflegen die Bestände ihrer Jugenden.

app.get("/api/inventory", requireAuth, async (c) => {
  const items = await db.listInventoryItems(c.env.DB);
  return c.json(
    c.get("role") === "admin" ? items : items.filter((item) => canAccessJugend(c.get("role"), c.get("jugendIds"), item.jugendId))
  );
});

app.post("/api/inventory", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 100);
  const unit = optionalText(body?.unit, 30);
  const quantity = validCount(body?.quantity);
  const minQuantity = validCount(body?.minQuantity);
  const maxQuantity = validOptionalCount(body?.maxQuantity);
  const note = optionalText(body?.note, 300);
  const jugendId = optionalId(body?.jugendId);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (unit === undefined) return c.json({ error: "Einheit ist ungültig" }, 400);
  if (quantity === undefined) return c.json({ error: "Bestand ist ungültig" }, 400);
  if (minQuantity === undefined) return c.json({ error: "Mindestbestand ist ungültig" }, 400);
  if (maxQuantity === undefined) return c.json({ error: "Maximalbestand ist ungültig" }, 400);
  if (note === undefined) return c.json({ error: "Hinweis ist zu lang" }, 400);
  if (jugendId === undefined) return c.json({ error: "Jugend ist ungültig" }, 400);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), jugendId)) return forbiddenJugend(c);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const item = await db.createInventoryItem(c.env.DB, {
    name,
    unit,
    quantity,
    minQuantity,
    maxQuantity,
    note,
    jugendId,
    sortOrder,
  });
  return c.json(item, 201);
});

app.put("/api/inventory/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 100);
  const unit = optionalText(body?.unit, 30);
  const quantity = validCount(body?.quantity);
  const minQuantity = validCount(body?.minQuantity);
  const maxQuantity = validOptionalCount(body?.maxQuantity);
  const note = optionalText(body?.note, 300);
  const jugendId = optionalId(body?.jugendId);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (unit === undefined) return c.json({ error: "Einheit ist ungültig" }, 400);
  if (quantity === undefined) return c.json({ error: "Bestand ist ungültig" }, 400);
  if (minQuantity === undefined) return c.json({ error: "Mindestbestand ist ungültig" }, 400);
  if (maxQuantity === undefined) return c.json({ error: "Maximalbestand ist ungültig" }, 400);
  if (note === undefined) return c.json({ error: "Hinweis ist zu lang" }, 400);
  if (jugendId === undefined) return c.json({ error: "Jugend ist ungültig" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const existing = await db.getInventoryItem(c.env.DB, id);
  if (!existing) return c.json({ error: "Artikel nicht gefunden" }, 404);
  if (
    !canAccessJugend(c.get("role"), c.get("jugendIds"), existing.jugendId) ||
    !canAccessJugend(c.get("role"), c.get("jugendIds"), jugendId)
  ) {
    return forbiddenJugend(c);
  }

  const item = await db.updateInventoryItem(c.env.DB, id, {
    name,
    unit,
    quantity,
    minQuantity,
    maxQuantity,
    note,
    jugendId,
    sortOrder,
  });
  if (!item) return c.json({ error: "Artikel nicht gefunden" }, 404);
  return c.json(item);
});

app.delete("/api/inventory/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const item = await db.getInventoryItem(c.env.DB, id);
  if (!item) return c.json({ error: "Artikel nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), item.jugendId)) return forbiddenJugend(c);
  await db.deleteInventoryItem(c.env.DB, id);
  return c.body(null, 204);
});

// --- Jugenden ------------------------------------------------------------------
// Trainer sehen nur ihre zugeordnete(n) Jugend(en); anlegen/umbenennen/
// löschen bleibt Admin-Sache.

app.get("/api/jugenden", requireAuth, async (c) => {
  const role = c.get("role");
  const allowed = c.get("jugendIds");
  const all = await db.listJugenden(c.env.DB);
  return c.json(role === "admin" ? all : all.filter((j) => allowed.includes(j.id)));
});

app.post("/api/jugenden", requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 100);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const jugend = await db.createJugend(c.env.DB, { name, sortOrder });
  return c.json(jugend, 201);
});

app.put("/api/jugenden/:id", requireAuth, requireAdmin, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 100);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const jugend = await db.updateJugend(c.env.DB, id, { name, sortOrder });
  if (!jugend) return c.json({ error: "Jugend nicht gefunden" }, 404);
  return c.json(jugend);
});

app.delete("/api/jugenden/:id", requireAuth, requireAdmin, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const result = await db.deleteJugend(c.env.DB, id);
  if (result.inUse) return c.json({ error: "Jugend wird noch von Eltern, Spielern, Turnieren oder Lagerartikeln verwendet" }, 409);
  return c.body(null, 204);
});

// --- Spieler -------------------------------------------------------------------

app.get("/api/players", requireAuth, async (c) => {
  const role = c.get("role");
  const allowed = c.get("jugendIds");
  const all = await db.listPlayers(c.env.DB);
  return c.json(role === "admin" ? all : all.filter((p) => allowed.includes(p.jugendId)));
});

app.post("/api/players", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const firstName = requiredText(body?.firstName, 100);
  const lastName = requiredText(body?.lastName, 100);
  const jugendId = validId(body?.jugendId);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!firstName) return c.json({ error: "Vorname fehlt oder ist ungültig" }, 400);
  if (!lastName) return c.json({ error: "Nachname fehlt oder ist ungültig" }, 400);
  if (!jugendId) return c.json({ error: "Jugend ist ungültig" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), jugendId)) return forbiddenJugend(c);

  const player = await db.createPlayer(c.env.DB, { firstName, lastName, jugendId, sortOrder });
  return c.json(player, 201);
});

app.put("/api/players/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const firstName = requiredText(body?.firstName, 100);
  const lastName = requiredText(body?.lastName, 100);
  const jugendId = validId(body?.jugendId);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!firstName) return c.json({ error: "Vorname fehlt oder ist ungültig" }, 400);
  if (!lastName) return c.json({ error: "Nachname fehlt oder ist ungültig" }, 400);
  if (!jugendId) return c.json({ error: "Jugend ist ungültig" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const role = c.get("role");
  const allowed = c.get("jugendIds");
  const existing = await db.getPlayer(c.env.DB, id);
  if (!existing) return c.json({ error: "Spieler nicht gefunden" }, 404);
  if (!canAccessJugend(role, allowed, existing.jugendId) || !canAccessJugend(role, allowed, jugendId)) {
    return forbiddenJugend(c);
  }

  const player = await db.updatePlayer(c.env.DB, id, { firstName, lastName, jugendId, sortOrder });
  if (!player) return c.json({ error: "Spieler nicht gefunden" }, 404);
  return c.json(player);
});

app.delete("/api/players/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const existing = await db.getPlayer(c.env.DB, id);
  if (existing && !canAccessJugend(c.get("role"), c.get("jugendIds"), existing.jugendId)) {
    return forbiddenJugend(c);
  }
  const result = await db.deletePlayer(c.env.DB, id);
  if (result.inUse) return c.json({ error: "Spieler wird noch von Eltern verwendet" }, 409);
  return c.body(null, 204);
});

// --- Eltern ------------------------------------------------------------------

app.get("/api/parents", requireAuth, async (c) => {
  const role = c.get("role");
  const allowed = c.get("jugendIds");
  const all = await db.listParents(c.env.DB);
  return c.json(role === "admin" ? all : all.filter((p) => p.jugendId !== null && allowed.includes(p.jugendId)));
});

app.post("/api/parents", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const playerId = validId(body?.playerId);
  const roleLabel = optionalText(body?.roleLabel, 50);
  const email = optionalEmail(body?.email);
  const phone = optionalText(body?.phone, 50);
  const notes = optionalText(body?.notes, 500);
  const active = body?.active === undefined ? true : validBool(body?.active);
  if (!playerId) return c.json({ error: "Spieler ist ungültig" }, 400);
  if (roleLabel === undefined) return c.json({ error: "Rolle ist ungültig" }, 400);
  if (email === undefined) return c.json({ error: "E-Mail ist ungültig" }, 400);
  if (phone === undefined) return c.json({ error: "Telefonnummer ist ungültig" }, 400);
  if (notes === undefined) return c.json({ error: "Notiz ist zu lang" }, 400);
  if (active === undefined) return c.json({ error: "Status ist ungültig" }, 400);

  const player = await db.getPlayer(c.env.DB, playerId);
  if (!player) return c.json({ error: "Spieler nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), player.jugendId)) return forbiddenJugend(c);

  const parent = await db.createParent(c.env.DB, {
    firstName: player.firstName,
    lastName: player.lastName,
    email,
    phone,
    notes,
    active,
    playerId,
    roleLabel,
  });
  return c.json(parent, 201);
});

app.put("/api/parents/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const playerId = validId(body?.playerId);
  const roleLabel = optionalText(body?.roleLabel, 50);
  const email = optionalEmail(body?.email);
  const phone = optionalText(body?.phone, 50);
  const notes = optionalText(body?.notes, 500);
  const active = validBool(body?.active);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!playerId) return c.json({ error: "Spieler ist ungültig" }, 400);
  if (roleLabel === undefined) return c.json({ error: "Rolle ist ungültig" }, 400);
  if (email === undefined) return c.json({ error: "E-Mail ist ungültig" }, 400);
  if (phone === undefined) return c.json({ error: "Telefonnummer ist ungültig" }, 400);
  if (notes === undefined) return c.json({ error: "Notiz ist zu lang" }, 400);
  if (active === undefined) return c.json({ error: "Status ist ungültig" }, 400);

  const role = c.get("role");
  const allowed = c.get("jugendIds");
  const existingParent = await db.getParent(c.env.DB, id);
  if (!existingParent) return c.json({ error: "Elternteil nicht gefunden" }, 404);
  if (!canAccessJugend(role, allowed, existingParent.jugendId)) return forbiddenJugend(c);

  const player = await db.getPlayer(c.env.DB, playerId);
  if (!player) return c.json({ error: "Spieler nicht gefunden" }, 404);
  if (!canAccessJugend(role, allowed, player.jugendId)) return forbiddenJugend(c);

  const parent = await db.updateParent(c.env.DB, id, {
    firstName: player.firstName,
    lastName: player.lastName,
    email,
    phone,
    notes,
    active,
    playerId,
    roleLabel,
  });
  if (!parent) return c.json({ error: "Elternteil nicht gefunden" }, 404);
  return c.json(parent);
});

app.delete("/api/parents/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const existing = await db.getParent(c.env.DB, id);
  if (existing && !canAccessJugend(c.get("role"), c.get("jugendIds"), existing.jugendId)) {
    return forbiddenJugend(c);
  }
  const result = await db.deleteParent(c.env.DB, id);
  if (result.inUse) return c.json({ error: "Elternteil ist bereits Diensten zugeteilt" }, 409);
  return c.body(null, 204);
});

app.get("/api/parents/:id/history", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const parent = await db.getParent(c.env.DB, id);
  if (!parent) return c.json({ error: "Elternteil nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), parent.jugendId)) return forbiddenJugend(c);
  return c.json({ parent, history: await db.getParentAssignmentHistory(c.env.DB, id) });
});

// --- Turniere ------------------------------------------------------------------

app.get("/api/tournaments", requireAuth, async (c) => {
  const role = c.get("role");
  const allowed = c.get("jugendIds");
  const all = await db.listTournaments(c.env.DB);
  return c.json(
    role === "admin" ? all : all.filter((t) => t.jugendId !== null && allowed.includes(t.jugendId))
  );
});

app.post("/api/tournaments", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 150);
  const type = validEnum(body?.type, TOURNAMENT_TYPE);
  const eventDate = validDate(body?.eventDate);
  const eventTime = validTime(body?.eventTime);
  const location = optionalText(body?.location, 200);
  const notes = optionalText(body?.notes, 500);
  const jugendId = optionalId(body?.jugendId);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (!type) return c.json({ error: "Turnierart ist ungültig" }, 400);
  if (!eventDate) return c.json({ error: "Datum ist ungültig (Format JJJJ-MM-TT)" }, 400);
  if (eventTime === undefined) return c.json({ error: "Uhrzeit ist ungültig (Format HH:MM)" }, 400);
  if (location === undefined) return c.json({ error: "Ort ist ungültig" }, 400);
  if (notes === undefined) return c.json({ error: "Notiz ist zu lang" }, 400);
  if (jugendId === undefined) return c.json({ error: "Jugend ist ungültig" }, 400);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), jugendId)) return forbiddenJugend(c);

  const tournament = await db.createTournament(c.env.DB, {
    name,
    type,
    eventDate,
    eventTime,
    location,
    notes,
    jugendId,
  });
  return c.json(tournament, 201);
});

app.put("/api/tournaments/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 150);
  const type = validEnum(body?.type, TOURNAMENT_TYPE);
  const eventDate = validDate(body?.eventDate);
  const eventTime = validTime(body?.eventTime);
  const location = optionalText(body?.location, 200);
  const notes = optionalText(body?.notes, 500);
  const jugendId = optionalId(body?.jugendId);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (!type) return c.json({ error: "Turnierart ist ungültig" }, 400);
  if (!eventDate) return c.json({ error: "Datum ist ungültig (Format JJJJ-MM-TT)" }, 400);
  if (eventTime === undefined) return c.json({ error: "Uhrzeit ist ungültig (Format HH:MM)" }, 400);
  if (location === undefined) return c.json({ error: "Ort ist ungültig" }, 400);
  if (notes === undefined) return c.json({ error: "Notiz ist zu lang" }, 400);
  if (jugendId === undefined) return c.json({ error: "Jugend ist ungültig" }, 400);

  const role = c.get("role");
  const allowed = c.get("jugendIds");
  const existing = await db.getTournament(c.env.DB, id);
  if (!existing) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!canAccessJugend(role, allowed, existing.jugendId) || !canAccessJugend(role, allowed, jugendId)) {
    return forbiddenJugend(c);
  }

  const tournament = await db.updateTournament(c.env.DB, id, {
    name,
    type,
    eventDate,
    eventTime,
    location,
    notes,
    jugendId,
  });
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  return c.json(tournament);
});

app.delete("/api/tournaments/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const existing = await db.getTournament(c.env.DB, id);
  if (existing && !canAccessJugend(c.get("role"), c.get("jugendIds"), existing.jugendId)) {
    return forbiddenJugend(c);
  }
  await db.deleteTournament(c.env.DB, id);
  return c.body(null, 204);
});

app.get("/api/tournaments/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const detail = await db.getTournamentDetail(c.env.DB, id);
  if (!detail) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), detail.jugendId)) return forbiddenJugend(c);
  return c.json(detail);
});

// --- Kasse einer Heimveranstaltung --------------------------------------------

app.get("/api/tournaments/:id/cash", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const tournament = await db.getTournament(c.env.DB, id);
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);
  if (tournament.type !== "home") return c.json({ error: "Eine Kasse kann nur für Heimveranstaltungen geführt werden" }, 400);
  return c.json(await db.getTournamentCashBox(c.env.DB, id));
});

app.put("/api/tournaments/:id/cash/opening-balance", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const openingBalanceCents = validCount(body?.openingBalanceCents);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (openingBalanceCents === undefined) return c.json({ error: "Anfangsbestand ist ungültig" }, 400);
  const tournament = await db.getTournament(c.env.DB, id);
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);
  if (tournament.type !== "home") return c.json({ error: "Eine Kasse kann nur für Heimveranstaltungen geführt werden" }, 400);
  return c.json(await db.setTournamentOpeningBalance(c.env.DB, id, openingBalanceCents));
});

app.post("/api/tournaments/:id/cash/transactions", requireAuth, async (c) => {
  const tournamentId = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const kind = validEnum(body?.kind, CASH_TRANSACTION_KIND);
  const category = validEnum(body?.category, CASH_TRANSACTION_CATEGORY);
  const description = requiredText(body?.description, 150);
  const amountCents = validCount(body?.amountCents);
  const occurredOn = validDate(body?.occurredOn);
  if (!tournamentId) return c.json({ error: "Ungültige ID" }, 400);
  if (!kind) return c.json({ error: "Buchungsart ist ungültig" }, 400);
  if (!category) return c.json({ error: "Kategorie ist ungültig" }, 400);
  if (!description) return c.json({ error: "Beschreibung fehlt oder ist ungültig" }, 400);
  if (amountCents === undefined || amountCents === 0) return c.json({ error: "Betrag muss größer als 0 sein" }, 400);
  if (!occurredOn) return c.json({ error: "Datum ist ungültig" }, 400);
  const tournament = await db.getTournament(c.env.DB, tournamentId);
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);
  if (tournament.type !== "home") return c.json({ error: "Buchungen sind nur bei Heimveranstaltungen möglich" }, 400);
  return c.json(
    await db.createCashTransaction(c.env.DB, { tournamentId, kind, category, description, amountCents, occurredOn }),
    201
  );
});

// Prüft die Berechtigung für eine bestehende Buchung: allgemeine Buchungen
// (tournamentId === null, z.B. Anschaffung von Sportgeräten) sind Admin-
// Sache, turniergebundene folgen der üblichen Jugend-Berechtigung.
async function assertCashTransactionAccess(c: Context<AppEnv>, transaction: { tournamentId: string | null }) {
  if (transaction.tournamentId === null) {
    return c.get("role") === "admin" ? null : c.json({ error: "Nur für Admins" }, 403);
  }
  const tournament = await db.getTournament(c.env.DB, transaction.tournamentId);
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);
  return null;
}

app.put("/api/cash-transactions/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const kind = validEnum(body?.kind, CASH_TRANSACTION_KIND);
  const category = validEnum(body?.category, CASH_TRANSACTION_CATEGORY);
  const description = requiredText(body?.description, 150);
  const amountCents = validCount(body?.amountCents);
  const occurredOn = validDate(body?.occurredOn);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!kind || !category || !description || amountCents === undefined || amountCents === 0 || !occurredOn) {
    return c.json({ error: "Buchung ist unvollständig oder ungültig" }, 400);
  }
  const transaction = await db.getCashTransaction(c.env.DB, id);
  if (!transaction) return c.json({ error: "Buchung nicht gefunden" }, 404);
  const denied = await assertCashTransactionAccess(c, transaction);
  if (denied) return denied;
  return c.json(await db.updateCashTransaction(c.env.DB, id, { kind, category, description, amountCents, occurredOn }));
});

app.delete("/api/cash-transactions/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const transaction = await db.getCashTransaction(c.env.DB, id);
  if (!transaction) return c.json({ error: "Buchung nicht gefunden" }, 404);
  const denied = await assertCashTransactionAccess(c, transaction);
  if (denied) return denied;
  await db.deleteCashTransaction(c.env.DB, id);
  return c.body(null, 204);
});

// --- Kassenbuch (vereinsweit) --------------------------------------------------
// Gesamtübersicht über alle Turnier-Kassen plus allgemeine, nicht
// turniergebundene Buchungen (z.B. Anschaffung von Sportgeräten). Trainer
// sehen nur die Turnier-Kassen ihrer Jugend(en); die allgemeine, vereinsweite
// Kasse ist Admins vorbehalten.
app.get("/api/cash/book", requireAuth, async (c) => {
  const book = await db.getClubCashBook(c.env.DB);
  const role = c.get("role");
  const allowed = c.get("jugendIds");
  const tournamentBoxes =
    role === "admin" ? book.tournamentBoxes : book.tournamentBoxes.filter((b) => canAccessJugend(role, allowed, b.jugendId));
  if (role === "admin") {
    return c.json({ ...book, tournamentBoxes });
  }
  return c.json({
    tournamentBoxes,
    generalTransactions: [],
    generalIncomeCents: 0,
    generalExpenseCents: 0,
    generalBalanceCents: 0,
    totalBalanceCents: tournamentBoxes.reduce((sum, b) => sum + b.currentBalanceCents, 0),
  });
});

app.post("/api/cash/general", requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const kind = validEnum(body?.kind, CASH_TRANSACTION_KIND);
  const category = validEnum(body?.category, CASH_TRANSACTION_CATEGORY);
  const description = requiredText(body?.description, 150);
  const amountCents = validCount(body?.amountCents);
  const occurredOn = validDate(body?.occurredOn);
  if (!kind) return c.json({ error: "Buchungsart ist ungültig" }, 400);
  if (!category) return c.json({ error: "Kategorie ist ungültig" }, 400);
  if (!description) return c.json({ error: "Beschreibung fehlt oder ist ungültig" }, 400);
  if (amountCents === undefined || amountCents === 0) return c.json({ error: "Betrag muss größer als 0 sein" }, 400);
  if (!occurredOn) return c.json({ error: "Datum ist ungültig" }, 400);

  return c.json(
    await db.createCashTransaction(c.env.DB, {
      tournamentId: null,
      kind,
      category,
      description,
      amountCents,
      occurredOn,
    }),
    201
  );
});

app.post("/api/tournaments/:id/auto-assign", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const tournament = await db.getTournament(c.env.DB, id);
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);
  const result = await db.autoAssignTournament(c.env.DB, id);
  const detail = await db.getTournamentDetail(c.env.DB, id);
  return c.json({ ...result, tournament: detail });
});

app.put("/api/tournaments/:id/available-players", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const tournament = await db.getTournament(c.env.DB, id);
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);

  if (!Array.isArray(body?.playerIds)) return c.json({ error: "Spieler-Liste fehlt" }, 400);
  const playerIds = body.playerIds.map((v: unknown) => validId(v));
  if (playerIds.some((v: string | undefined) => !v)) return c.json({ error: "Ungültige Spieler-ID" }, 400);

  await db.setAvailablePlayers(c.env.DB, id, playerIds as string[]);
  const detail = await db.getTournamentDetail(c.env.DB, id);
  return c.json(detail);
});

// --- Dienst-Slots eines Turniers ---------------------------------------------

app.post("/api/tournaments/:id/slots", requireAuth, async (c) => {
  const tournamentId = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const dutyTypeId = validId(body?.dutyTypeId);
  const label = optionalText(body?.label, 100);
  const time = validTime(body?.time);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!tournamentId) return c.json({ error: "Ungültige Turnier-ID" }, 400);
  const tournament = await db.getTournament(c.env.DB, tournamentId);
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);
  if (!dutyTypeId) return c.json({ error: "Dienst-Typ ist ungültig" }, 400);
  if (label === undefined) return c.json({ error: "Bezeichnung ist ungültig" }, 400);
  if (time === undefined) return c.json({ error: "Uhrzeit ist ungültig (Format HH:MM)" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const slot = await db.createSlot(c.env.DB, { tournamentId, dutyTypeId, label, time, sortOrder });
  return c.json(slot, 201);
});

// Tauscht die Zuteilungen zweier Slots desselben Turniers (z.B. Grillen und
// Bonkasse gegenseitig). Beide Slots müssen bereits zugeteilt sein. Muss VOR
// "/api/slots/:id" registriert sein, sonst matcht der Parameter-Handler
// zuerst und interpretiert "swap" als Slot-ID.
app.put("/api/slots/swap", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const slotIdA = validId(body?.slotIdA);
  const slotIdB = validId(body?.slotIdB);
  if (!slotIdA || !slotIdB) return c.json({ error: "Ungültige Slot-IDs" }, 400);
  if (slotIdA === slotIdB) return c.json({ error: "Ein Slot kann nicht mit sich selbst getauscht werden" }, 400);

  const tournament = await getTournamentForSlot(c.env.DB, slotIdA);
  if (!tournament) return c.json({ error: "Dienst-Slot nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);

  const result = await db.swapSlotAssignments(c.env.DB, slotIdA, slotIdB);
  if (!result.ok) {
    if (result.reason === "not_assigned") {
      return c.json({ error: "Beide Slots müssen bereits zugeteilt sein, um zu tauschen" }, 409);
    }
    if (result.reason === "different_tournament") {
      return c.json({ error: "Ein Tausch ist nur innerhalb desselben Turniers möglich" }, 400);
    }
    return c.json({ error: "Diese Slots sind bereits demselben Elternteil zugeteilt" }, 409);
  }
  return c.json({ ok: true });
});

app.put("/api/slots/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const dutyTypeId = validId(body?.dutyTypeId);
  const label = optionalText(body?.label, 100);
  const time = validTime(body?.time);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!dutyTypeId) return c.json({ error: "Dienst-Typ ist ungültig" }, 400);
  if (label === undefined) return c.json({ error: "Bezeichnung ist ungültig" }, 400);
  if (time === undefined) return c.json({ error: "Uhrzeit ist ungültig (Format HH:MM)" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const tournament = await getTournamentForSlot(c.env.DB, id);
  if (!tournament) return c.json({ error: "Dienst-Slot nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);

  const slot = await db.updateSlot(c.env.DB, id, { dutyTypeId, label, time, sortOrder });
  if (!slot) return c.json({ error: "Dienst-Slot nicht gefunden" }, 404);
  return c.json(slot);
});

app.delete("/api/slots/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const tournament = await getTournamentForSlot(c.env.DB, id);
  if (tournament && !canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) {
    return forbiddenJugend(c);
  }
  await db.deleteSlot(c.env.DB, id);
  return c.body(null, 204);
});

app.put("/api/slots/:id/assignment", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);

  const tournament = await getTournamentForSlot(c.env.DB, id);
  if (!tournament) return c.json({ error: "Dienst-Slot nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);

  if (body?.parentId === null) {
    await db.unassignSlot(c.env.DB, id);
    return c.json({ ok: true });
  }

  const parentId = optionalId(body?.parentId);
  if (!parentId) return c.json({ error: "Ungültiges Elternteil" }, 400);

  const result = await db.assignParentToSlot(c.env.DB, id, parentId, { status: "confirmed" });
  if (!result.ok) {
    if (result.reason === "slot_not_found") return c.json({ error: "Dienst-Slot nicht gefunden" }, 404);
    if (result.reason === "parent_not_found") return c.json({ error: "Elternteil nicht gefunden" }, 404);
    return c.json(
      { error: "Dieses Elternteil ist bei diesem Turnier bereits einem anderen Dienst zugeteilt" },
      409
    );
  }
  return c.json(result.assignment);
});

app.put("/api/slots/:id/assignment/confirm", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const tournament = await getTournamentForSlot(c.env.DB, id);
  if (!tournament) return c.json({ error: "Dienst-Slot nicht gefunden" }, 404);
  if (!canAccessJugend(c.get("role"), c.get("jugendIds"), tournament.jugendId)) return forbiddenJugend(c);

  const result = await db.confirmSlotAssignment(c.env.DB, id);
  if (!result.ok) return c.json({ error: "Keine offene Meldung für diesen Dienst-Slot" }, 404);
  return c.json({ ok: true });
});

// --- Fairness / Übersicht -----------------------------------------------------

app.get("/api/fairness", requireAuth, async (c) => {
  const role = c.get("role");
  if (role === "trainer") {
    return c.json(await db.getFairnessOverview(c.env.DB, c.get("jugendIds")));
  }
  const jugendId = validId(c.req.query("jugendId"));
  return c.json(await db.getFairnessOverview(c.env.DB, jugendId ? [jugendId] : null));
});

// --- Nutzer (nur Admin) --------------------------------------------------------

app.get("/api/users", requireAuth, requireAdmin, async (c) => {
  return c.json(await db.listUsers(c.env.DB));
});

app.post("/api/users", requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = normalizedEmail(body?.email);
  const name = optionalText(body?.name, 100);
  const password = validPassword(body?.password);
  const role = validEnum(body?.role, ROLES);
  const jugendIdsRaw = Array.isArray(body?.jugendIds) ? body.jugendIds : [];
  const jugendIds = jugendIdsRaw.map((v: unknown) => validId(v));
  if (!email) return c.json({ error: "E-Mail ist ungültig" }, 400);
  if (name === undefined) return c.json({ error: "Name ist ungültig" }, 400);
  if (!password) return c.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, 400);
  if (!role) return c.json({ error: "Rolle ist ungültig" }, 400);
  if (jugendIds.some((v: string | undefined) => !v)) return c.json({ error: "Jugend-Auswahl ist ungültig" }, 400);

  const existing = await db.getUserByEmail(c.env.DB, email);
  if (existing) return c.json({ error: "E-Mail wird bereits verwendet" }, 409);

  const { hash, salt } = await hashPassword(password);
  const user = await db.createUser(c.env.DB, { email, name, passwordHash: hash, passwordSalt: salt, role });
  const finalJugendIds = role === "trainer" ? (jugendIds as string[]) : [];
  if (role === "trainer") await db.setTrainerJugenden(c.env.DB, user.id, finalJugendIds);
  return c.json({ ...user, jugendIds: finalJugendIds }, 201);
});

app.put("/api/users/:id", requireAuth, requireAdmin, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const name = optionalText(body?.name, 100);
  const role = validEnum(body?.role, ROLES);
  const password = body?.password ? validPassword(body.password) : undefined;
  const jugendIdsRaw = Array.isArray(body?.jugendIds) ? body.jugendIds : [];
  const jugendIds = jugendIdsRaw.map((v: unknown) => validId(v));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (name === undefined) return c.json({ error: "Name ist ungültig" }, 400);
  if (!role) return c.json({ error: "Rolle ist ungültig" }, 400);
  if (body?.password && !password) return c.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, 400);
  if (jugendIds.some((v: string | undefined) => !v)) return c.json({ error: "Jugend-Auswahl ist ungültig" }, 400);

  let passwordHash: string | undefined;
  let passwordSalt: string | undefined;
  if (password) {
    const hashed = await hashPassword(password);
    passwordHash = hashed.hash;
    passwordSalt = hashed.salt;
  }
  const user = await db.updateUser(c.env.DB, id, { name, role, passwordHash, passwordSalt });
  if (!user) return c.json({ error: "Nutzer nicht gefunden" }, 404);
  const finalJugendIds = role === "trainer" ? (jugendIds as string[]) : [];
  await db.setTrainerJugenden(c.env.DB, id, finalJugendIds);
  return c.json({ ...user, jugendIds: finalJugendIds });
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (id === c.get("userId")) return c.json({ error: "Der eigene Account kann nicht gelöscht werden" }, 400);
  await db.deleteUser(c.env.DB, id);
  return c.body(null, 204);
});

app.onError((error, c) => {
  console.error("Unbehandelter API-Fehler:", error);
  if (error instanceof SyntaxError) return c.json({ error: "Ungültiger JSON-Request" }, 400);
  return c.json({ error: "Interner Serverfehler" }, 500);
});

export default app;
