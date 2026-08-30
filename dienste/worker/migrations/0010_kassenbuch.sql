-- Erlaubt Buchungen ohne Turnier-Bezug (z.B. Anschaffung von Sportgeräten,
-- Waffeleisen, Kaffeemaschine) für das vereinsweite Kassenbuch. SQLite kann
-- eine NOT-NULL-Spalte nicht per ALTER TABLE lockern, daher Tabellen-Rebuild
-- unter Erhalt bestehender Buchungen. Zusätzlich neue Kategorie "equipment".
ALTER TABLE cash_transactions RENAME TO cash_transactions_old;

CREATE TABLE cash_transactions (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  category TEXT NOT NULL CHECK (category IN ('sales', 'drinks', 'grill', 'supplies', 'gas', 'equipment', 'other')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  occurred_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO cash_transactions (id, tournament_id, kind, category, description, amount_cents, occurred_on, created_at)
  SELECT id, tournament_id, kind, category, description, amount_cents, occurred_on, created_at FROM cash_transactions_old;

DROP TABLE cash_transactions_old;

CREATE INDEX idx_cash_transactions_tournament_date
  ON cash_transactions(tournament_id, occurred_on, created_at);
