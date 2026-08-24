-- Öffentliche Meldungen sind zunächst "pending" (wartet auf Freigabe) statt
-- sofort "confirmed" (Trainer-/Admin-Zuteilung, auch Auto-Zuteilung).
ALTER TABLE assignments ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed';
