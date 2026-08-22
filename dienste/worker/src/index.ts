import { Hono } from "hono";
import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import * as db from "./db";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./auth";
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
  validSortOrder,
} from "./validation";
import type { Env } from "./types";

type Variables = {
  userId: string;
  email: string;
  name: string | null;
};

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

const APPLIES_TO = ["home", "away", "both"] as const;
const TOURNAMENT_TYPE = ["home", "away"] as const;

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
  } catch {
    return c.json({ error: "Nicht angemeldet" }, 401);
  }
  await next();
};

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
  return c.json({ token, user: { id: userRow.id, email: userRow.email, name: userRow.name } });
});

app.get("/api/me", requireAuth, async (c) => {
  return c.json({ id: c.get("userId"), email: c.get("email"), name: c.get("name") });
});

// --- Öffentliche Ansicht (kein Login nötig) --------------------------------

app.get("/api/public/tournaments", async (c) => {
  return c.json(await db.listPublicTournaments(c.env.DB));
});

// --- Dienst-Typen ------------------------------------------------------------

app.get("/api/duty-types", requireAuth, async (c) => {
  return c.json(await db.listDutyTypes(c.env.DB));
});

app.post("/api/duty-types", requireAuth, async (c) => {
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

app.put("/api/duty-types/:id", requireAuth, async (c) => {
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

app.delete("/api/duty-types/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const result = await db.deleteDutyType(c.env.DB, id);
  if (result.inUse) return c.json({ error: "Dienst-Typ wird noch bei Turnieren verwendet" }, 409);
  return c.body(null, 204);
});

// --- Eltern ------------------------------------------------------------------

app.get("/api/parents", requireAuth, async (c) => {
  return c.json(await db.listParents(c.env.DB));
});

app.post("/api/parents", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const firstName = requiredText(body?.firstName, 100);
  const lastName = requiredText(body?.lastName, 100);
  const childName = optionalText(body?.childName, 100);
  const email = optionalEmail(body?.email);
  const phone = optionalText(body?.phone, 50);
  const notes = optionalText(body?.notes, 500);
  const active = body?.active === undefined ? true : validBool(body?.active);
  if (!firstName) return c.json({ error: "Vorname fehlt oder ist ungültig" }, 400);
  if (!lastName) return c.json({ error: "Nachname fehlt oder ist ungültig" }, 400);
  if (childName === undefined) return c.json({ error: "Name des Kindes ist ungültig" }, 400);
  if (email === undefined) return c.json({ error: "E-Mail ist ungültig" }, 400);
  if (phone === undefined) return c.json({ error: "Telefonnummer ist ungültig" }, 400);
  if (notes === undefined) return c.json({ error: "Notiz ist zu lang" }, 400);
  if (active === undefined) return c.json({ error: "Status ist ungültig" }, 400);

  const parent = await db.createParent(c.env.DB, { firstName, lastName, childName, email, phone, notes, active });
  return c.json(parent, 201);
});

app.put("/api/parents/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const firstName = requiredText(body?.firstName, 100);
  const lastName = requiredText(body?.lastName, 100);
  const childName = optionalText(body?.childName, 100);
  const email = optionalEmail(body?.email);
  const phone = optionalText(body?.phone, 50);
  const notes = optionalText(body?.notes, 500);
  const active = validBool(body?.active);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!firstName) return c.json({ error: "Vorname fehlt oder ist ungültig" }, 400);
  if (!lastName) return c.json({ error: "Nachname fehlt oder ist ungültig" }, 400);
  if (childName === undefined) return c.json({ error: "Name des Kindes ist ungültig" }, 400);
  if (email === undefined) return c.json({ error: "E-Mail ist ungültig" }, 400);
  if (phone === undefined) return c.json({ error: "Telefonnummer ist ungültig" }, 400);
  if (notes === undefined) return c.json({ error: "Notiz ist zu lang" }, 400);
  if (active === undefined) return c.json({ error: "Status ist ungültig" }, 400);

  const parent = await db.updateParent(c.env.DB, id, { firstName, lastName, childName, email, phone, notes, active });
  if (!parent) return c.json({ error: "Elternteil nicht gefunden" }, 404);
  return c.json(parent);
});

app.delete("/api/parents/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const result = await db.deleteParent(c.env.DB, id);
  if (result.inUse) return c.json({ error: "Elternteil ist bereits Diensten zugeteilt" }, 409);
  return c.body(null, 204);
});

// --- Turniere ------------------------------------------------------------------

app.get("/api/tournaments", requireAuth, async (c) => {
  return c.json(await db.listTournaments(c.env.DB));
});

app.post("/api/tournaments", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 150);
  const type = validEnum(body?.type, TOURNAMENT_TYPE);
  const eventDate = validDate(body?.eventDate);
  const location = optionalText(body?.location, 200);
  const notes = optionalText(body?.notes, 500);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (!type) return c.json({ error: "Turnierart ist ungültig" }, 400);
  if (!eventDate) return c.json({ error: "Datum ist ungültig (Format JJJJ-MM-TT)" }, 400);
  if (location === undefined) return c.json({ error: "Ort ist ungültig" }, 400);
  if (notes === undefined) return c.json({ error: "Notiz ist zu lang" }, 400);

  const tournament = await db.createTournament(c.env.DB, { name, type, eventDate, location, notes });
  return c.json(tournament, 201);
});

app.put("/api/tournaments/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const name = requiredText(body?.name, 150);
  const type = validEnum(body?.type, TOURNAMENT_TYPE);
  const eventDate = validDate(body?.eventDate);
  const location = optionalText(body?.location, 200);
  const notes = optionalText(body?.notes, 500);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!name) return c.json({ error: "Name fehlt oder ist ungültig" }, 400);
  if (!type) return c.json({ error: "Turnierart ist ungültig" }, 400);
  if (!eventDate) return c.json({ error: "Datum ist ungültig (Format JJJJ-MM-TT)" }, 400);
  if (location === undefined) return c.json({ error: "Ort ist ungültig" }, 400);
  if (notes === undefined) return c.json({ error: "Notiz ist zu lang" }, 400);

  const tournament = await db.updateTournament(c.env.DB, id, { name, type, eventDate, location, notes });
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  return c.json(tournament);
});

app.delete("/api/tournaments/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  await db.deleteTournament(c.env.DB, id);
  return c.body(null, 204);
});

app.get("/api/tournaments/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const detail = await db.getTournamentDetail(c.env.DB, id);
  if (!detail) return c.json({ error: "Turnier nicht gefunden" }, 404);
  return c.json(detail);
});

app.post("/api/tournaments/:id/auto-assign", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  const tournament = await db.getTournament(c.env.DB, id);
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  const result = await db.autoAssignTournament(c.env.DB, id);
  const detail = await db.getTournamentDetail(c.env.DB, id);
  return c.json({ ...result, tournament: detail });
});

// --- Dienst-Slots eines Turniers ---------------------------------------------

app.post("/api/tournaments/:id/slots", requireAuth, async (c) => {
  const tournamentId = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const dutyTypeId = validId(body?.dutyTypeId);
  const label = optionalText(body?.label, 100);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!tournamentId) return c.json({ error: "Ungültige Turnier-ID" }, 400);
  const tournament = await db.getTournament(c.env.DB, tournamentId);
  if (!tournament) return c.json({ error: "Turnier nicht gefunden" }, 404);
  if (!dutyTypeId) return c.json({ error: "Dienst-Typ ist ungültig" }, 400);
  if (label === undefined) return c.json({ error: "Bezeichnung ist ungültig" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const slot = await db.createSlot(c.env.DB, { tournamentId, dutyTypeId, label, sortOrder });
  return c.json(slot, 201);
});

app.put("/api/slots/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const dutyTypeId = validId(body?.dutyTypeId);
  const label = optionalText(body?.label, 100);
  const sortOrder = validSortOrder(body?.sortOrder);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  if (!dutyTypeId) return c.json({ error: "Dienst-Typ ist ungültig" }, 400);
  if (label === undefined) return c.json({ error: "Bezeichnung ist ungültig" }, 400);
  if (sortOrder === undefined) return c.json({ error: "Sortierung ist ungültig" }, 400);

  const slot = await db.updateSlot(c.env.DB, id, { dutyTypeId, label, sortOrder });
  if (!slot) return c.json({ error: "Dienst-Slot nicht gefunden" }, 404);
  return c.json(slot);
});

app.delete("/api/slots/:id", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  if (!id) return c.json({ error: "Ungültige ID" }, 400);
  await db.deleteSlot(c.env.DB, id);
  return c.body(null, 204);
});

app.put("/api/slots/:id/assignment", requireAuth, async (c) => {
  const id = validId(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  if (!id) return c.json({ error: "Ungültige ID" }, 400);

  if (body?.parentId === null) {
    await db.unassignSlot(c.env.DB, id);
    return c.json({ ok: true });
  }

  const parentId = optionalId(body?.parentId);
  if (!parentId) return c.json({ error: "Ungültiges Elternteil" }, 400);

  const result = await db.assignParentToSlot(c.env.DB, id, parentId);
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

// --- Fairness / Übersicht -----------------------------------------------------

app.get("/api/fairness", requireAuth, async (c) => {
  return c.json(await db.getFairnessOverview(c.env.DB));
});

app.onError((error, c) => {
  console.error("Unbehandelter API-Fehler:", error);
  if (error instanceof SyntaxError) return c.json({ error: "Ungültiger JSON-Request" }, 400);
  return c.json({ error: "Interner Serverfehler" }, 500);
});

export default app;
