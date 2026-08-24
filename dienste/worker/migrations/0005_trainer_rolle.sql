-- Rollen-Modell: bestehende Nutzer sind automatisch 'admin' (volle Sicht).
-- Neue Trainer-Nutzer sehen/verwalten nur ihre zugeordnete(n) Jugend(en).
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';

CREATE TABLE trainer_jugenden (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jugend_id TEXT NOT NULL REFERENCES jugenden(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, jugend_id)
);
CREATE INDEX idx_trainer_jugenden_jugend ON trainer_jugenden(jugend_id);
