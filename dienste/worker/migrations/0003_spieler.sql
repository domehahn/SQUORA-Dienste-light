-- Spieler gehören verpflichtend zu einer Jugend/Mannschaft.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  jugend_id TEXT NOT NULL REFERENCES jugenden(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_players_jugend ON players(jugend_id);

-- Eltern werden künftig über den Spieler identifiziert statt über einen
-- eigenen Namen. first_name/last_name/child_name/jugend_id auf parents
-- bleiben aus Bestandsschutz-Gründen bestehen, werden app-seitig aber nicht
-- mehr abgefragt - player_id ist ab sofort das Identitätsmerkmal.
ALTER TABLE parents ADD COLUMN player_id TEXT REFERENCES players(id) ON DELETE RESTRICT;
ALTER TABLE parents ADD COLUMN role_label TEXT;
CREATE INDEX idx_parents_player ON parents(player_id);
