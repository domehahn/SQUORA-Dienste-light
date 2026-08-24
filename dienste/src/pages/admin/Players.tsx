import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import type { Jugend, Player } from "../../lib/types";
import { FloatingInput, FloatingSelect } from "../../components/FloatingField";

const EMPTY = { firstName: "", lastName: "", jugendId: "" };

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [jugenden, setJugenden] = useState<Jugend[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, j] = await Promise.all([
        api.get<Player[]>("/api/players"),
        api.get<Jugend[]>("/api/jugenden"),
      ]);
      setPlayers(p);
      setJugenden(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(p: Player) {
    setEditingId(p.id);
    setForm({ firstName: p.firstName, lastName: p.lastName, jugendId: p.jugendId });
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
        firstName: form.firstName,
        lastName: form.lastName,
        jugendId: form.jugendId,
        sortOrder: 0,
      };
      if (editingId) await api.put(`/api/players/${editingId}`, payload);
      else await api.post("/api/players", payload);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Spieler wirklich löschen?")) return;
    try {
      await api.del(`/api/players/${id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Spieler</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Spieler der Mannschaften. Eltern werden nicht mit eigenem Namen erfasst, sondern über den Spieler
          identifiziert (z.B. „Eltern von Max Mustermann") – daher muss jeder Spieler zunächst hier angelegt
          werden.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3"
      >
        <FloatingInput
          label="Vorname"
          required
          value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
        />
        <FloatingInput
          label="Nachname"
          required
          value={form.lastName}
          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
        />
        <FloatingSelect
          label="Jugend"
          required
          value={form.jugendId}
          onChange={(e) => setForm((f) => ({ ...f, jugendId: e.target.value }))}
        >
          <option value="">– auswählen –</option>
          {jugenden.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </FloatingSelect>
        <div className="flex items-end gap-3 sm:col-span-3">
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

      {error && <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>
      ) : players.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Noch keine Spieler angelegt.</p>
      ) : (
        <div className="space-y-6">
          {jugenden
            .map((j) => ({ jugend: j, players: players.filter((p) => p.jugendId === j.id) }))
            .filter((group) => group.players.length > 0)
            .map(({ jugend, players: groupPlayers }) => (
              <div key={jugend.id}>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{jugend.name}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupPlayers.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                            {p.firstName} {p.lastName}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => startEdit(p)}
                              className="mr-3 text-sm text-blue-700 hover:underline dark:text-blue-400"
                            >
                              Bearbeiten
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="text-sm text-red-600 hover:underline dark:text-red-400"
                            >
                              Löschen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
