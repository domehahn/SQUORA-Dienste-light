-- Lagerartikel können einer Jugend zugeordnet werden. Bestehende Artikel
-- bleiben als Vereinsbestand ohne Jugend erhalten.
ALTER TABLE inventory_items ADD COLUMN jugend_id TEXT REFERENCES jugenden(id) ON DELETE RESTRICT;

CREATE INDEX idx_inventory_items_jugend ON inventory_items(jugend_id);

-- Pro Heimveranstaltung gibt es genau eine Kasse. Geldbeträge werden als
-- Cent gespeichert, damit keine Rundungsfehler durch Fließkommazahlen entstehen.
CREATE TABLE tournament_cash_boxes (
  tournament_id TEXT PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
  opening_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance_cents >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cash_transactions (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  category TEXT NOT NULL CHECK (category IN ('sales', 'drinks', 'grill', 'supplies', 'gas', 'other')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  occurred_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cash_transactions_tournament_date
  ON cash_transactions(tournament_id, occurred_on, created_at);
