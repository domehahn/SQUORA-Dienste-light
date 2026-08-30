-- Optionale Verknüpfung einer Kassen-Buchung mit einem Lagerartikel + Menge:
-- Ausgaben (Einkauf, z.B. 20 Bratwürste) erhöhen den Lagerbestand um die
-- Menge, Einnahmen (Verkauf) verringern ihn entsprechend. Beide Felder
-- bleiben optional - Verbrauchsmaterialien (Servietten, Becher, …) werden
-- i.d.R. nur bei Ausgaben verknüpft, nie bei Einnahmen, da sie nicht einzeln
-- verkauft werden; das ist reine Nutzungskonvention, keine erzwungene Regel.
ALTER TABLE cash_transactions ADD COLUMN inventory_item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL;
ALTER TABLE cash_transactions ADD COLUMN quantity INTEGER;
