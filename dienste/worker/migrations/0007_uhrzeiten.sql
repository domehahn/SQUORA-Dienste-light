-- Uhrzeit für Turnier-Beginn und optional je Dienst-Slot (z.B. unterschiedliche
-- Schichten desselben Dienstes), beides optional (Format HH:MM).
ALTER TABLE tournaments ADD COLUMN event_time TEXT;
ALTER TABLE tournament_slots ADD COLUMN time TEXT;
