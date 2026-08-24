-- Jugend/Team-Struktur (z.B. D-Jugend, F-Jugend). Eltern und Turniere können
-- optional einer Jugend zugeordnet werden; ohne Zuordnung verhält sich alles
-- wie zuvor (globaler Pool).
CREATE TABLE jugenden (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE parents ADD COLUMN jugend_id TEXT REFERENCES jugenden(id);
ALTER TABLE tournaments ADD COLUMN jugend_id TEXT REFERENCES jugenden(id);

CREATE INDEX idx_parents_jugend ON parents(jugend_id);
CREATE INDEX idx_tournaments_jugend ON tournaments(jugend_id);
