import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { inventoryLevel, type InventoryItem, type InventoryLevel } from "../../lib/types";
import { FloatingInput } from "../../components/FloatingField";

const LEVEL_BADGE_CLASSES: Record<InventoryLevel, string> = {
  low: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
};

const LEVEL_LABELS: Record<InventoryLevel, string> = {
  low: "Bestand niedrig – bitte rechtzeitig bestellen",
  high: "Bestand hoch",
  ok: "Bestand ok",
};

const EMPTY = { name: "", unit: "", quantity: "0", minQuantity: "0", maxQuantity: "", note: "" };

export default function Inventory() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.get<InventoryItem[]>("/api/inventory"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      unit: item.unit ?? "",
      quantity: String(item.quantity),
      minQuantity: String(item.minQuantity),
      maxQuantity: item.maxQuantity != null ? String(item.maxQuantity) : "",
      note: item.note ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: form.name,
        unit: form.unit || null,
        quantity: Number(form.quantity),
        minQuantity: Number(form.minQuantity),
        maxQuantity: form.maxQuantity === "" ? null : Number(form.maxQuantity),
        note: form.note || null,
        sortOrder: 0,
      };
      if (editingId) await api.put(`/api/inventory/${editingId}`, payload);
      else await api.post("/api/inventory", payload);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Artikel wirklich löschen?")) return;
    try {
      await api.del(`/api/inventory/${id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Lagerbestand</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Vorräte für Grillen, Getränke & Co. Bei Unterschreitung des Mindestbestands (oder Überschreitung des
          optionalen Maximalbestands) erscheint ein Hinweis.
        </p>
      </div>

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="sm:col-span-2">
            <FloatingInput
              label="Artikel (z.B. Würstchen)"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <FloatingInput
            label="Einheit (optional, z.B. Stück, Kisten)"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
          />
          <FloatingInput
            label="Aktueller Bestand"
            type="number"
            min={0}
            required
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          <FloatingInput
            label="Mindestbestand"
            type="number"
            min={0}
            required
            value={form.minQuantity}
            onChange={(e) => setForm((f) => ({ ...f, minQuantity: e.target.value }))}
          />
          <FloatingInput
            label="Maximalbestand (optional)"
            type="number"
            min={0}
            value={form.maxQuantity}
            onChange={(e) => setForm((f) => ({ ...f, maxQuantity: e.target.value }))}
          />
          <div className="sm:col-span-2 lg:col-span-2">
            <FloatingInput
              label="Hinweis (optional, z.B. Bestellung bei Metzgerei Muster, 3 Tage Vorlauf)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {editingId ? "Speichern" : "Anlegen"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Abbrechen
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2 font-medium">Artikel</th>
                <th className="px-4 py-2 font-medium">Bestand</th>
                <th className="px-4 py-2 font-medium">Mindest-/Maximalbestand</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Hinweis</th>
                {isAdmin && <th className="px-4 py-2 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const level = inventoryLevel(item);
                return (
                  <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{item.name}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      min. {item.minQuantity}
                      {item.maxQuantity != null ? ` · max. ${item.maxQuantity}` : ""}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_BADGE_CLASSES[level]}`}>
                        {LEVEL_LABELS[level]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{item.note ?? "–"}</td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => startEdit(item)}
                          className="mr-3 text-sm text-blue-700 hover:underline dark:text-blue-400"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-sm text-red-600 hover:underline dark:text-red-400"
                        >
                          Löschen
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    Noch keine Artikel angelegt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
