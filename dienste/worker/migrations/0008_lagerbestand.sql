-- Lagerbestandsverwaltung (Würstchen, Getränke, Brötchen, …): aktueller
-- Bestand + administrierbare Mindest-/Maximalmenge, auf deren Basis das
-- Frontend Hinweise bei zu niedrigem oder zu hohem Bestand anzeigt.
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  max_quantity INTEGER,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
