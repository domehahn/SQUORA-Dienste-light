-- Pro Turnier ausgewählte verfügbare Spieler ("welche Kinder sind bei diesem
-- Turnier überhaupt dabei") - schränkt den Kandidatenpool für Dienst-
-- Zuteilungen auf deren Eltern ein. Leere Auswahl = keine Einschränkung
-- (Bestandsschutz für bereits angelegte Turniere ohne diese Angabe).
CREATE TABLE tournament_players (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (tournament_id, player_id)
);
CREATE INDEX idx_tournament_players_player ON tournament_players(player_id);
