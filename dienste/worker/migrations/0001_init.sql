-- Basisschema: Login-Nutzer, Eltern, Dienst-Typen, Turniere, Dienst-Slots,
-- Zuteilungen.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Eltern/Familien, die für Dienste eingeteilt werden können.
CREATE TABLE parents (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  child_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Katalog der Dienst-Arten (Grillen, Bonkasse, Kuchenverkauf, Pommes,
-- Getränke, Trikotwäsche, ...). "applies_to" steuert, bei welcher Turnierart
-- der Dienst grundsätzlich vorkommt (Trikotwäsche: 'both').
CREATE TABLE duty_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('home', 'away', 'both')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('home', 'away')),
  event_date TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ein Slot ist eine konkret zu besetzende Stelle bei einem Turnier, z.B.
-- "Grillen" oder "Grillen (Frühschicht)". Mehrere Slots desselben Dienst-Typs
-- pro Turnier sind möglich (label unterscheidet sie).
CREATE TABLE tournament_slots (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  duty_type_id TEXT NOT NULL REFERENCES duty_types(id) ON DELETE RESTRICT,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Zuteilung eines Elternteils zu einem Slot. UNIQUE(slot_id) => je Slot nur
-- eine Zuteilung. UNIQUE(tournament_id, parent_id) => ein Elternteil kann bei
-- einem Turnier nicht mehrfach eingeteilt werden (fachliche Kernregel).
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL UNIQUE REFERENCES tournament_slots(id) ON DELETE CASCADE,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE RESTRICT,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT,
  UNIQUE (tournament_id, parent_id)
);

CREATE INDEX idx_tournament_slots_tournament ON tournament_slots(tournament_id);
CREATE INDEX idx_tournament_slots_duty_type ON tournament_slots(duty_type_id);
CREATE INDEX idx_assignments_parent ON assignments(parent_id);
CREATE INDEX idx_assignments_tournament ON assignments(tournament_id);
