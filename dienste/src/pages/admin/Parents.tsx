import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { parentLabel, type Jugend, type Parent, type Player } from "../../lib/types";
import { FloatingInput, FloatingSelect } from "../../components/FloatingField";

const EMPTY = {
  playerId: "",
  roleLabel: "",
  email: "",
  phone: "",
  notes: "",
  active: true,
};

export default function Parents() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [jugenden, setJugenden] = useState<Jugend[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, pl, j] = await Promise.all([
        api.get<Parent[]>("/api/parents"),
        api.get<Player[]>("/api/players"),
        api.get<Jugend[]>("/api/jugenden"),
      ]);
      setParents(p);
      setPlayers(pl);
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

  function startEdit(p: Parent) {
    setEditingId(p.id);
    setForm({
      playerId: p.playerId ?? "",
      roleLabel: p.roleLabel ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      notes: p.notes ?? "",
      active: p.active,
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
        playerId: form.playerId,
        roleLabel: form.roleLabel || null,
        email: form.email || null,
        phone: form.phone || null,
        notes: form.notes || null,
        active: form.active,
      };
      if (editingId) await api.put(`/api/parents/${editingId}`, payload);
      else await api.post("/api/parents", payload);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Elternteil wirklich löschen?")) return;
    try {
      await api.del(`/api/parents/${id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Eltern</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Eltern werden nicht mit eigenem Namen erfasst, sondern über den Spieler identifiziert, dessen Eltern sie
          sind. Falls beide Elternteile eines Spielers angelegt werden, hilft das optionale Rollenfeld (z.B.
          „Mutter"/„Vater") bei der Unterscheidung. Inaktive Eltern werden bei der automatischen Zuteilung
          übersprungen.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FloatingSelect
          label="Spieler"
          required
          value={form.playerId}
          onChange={(e) => setForm((f) => ({ ...f, playerId: e.target.value }))}
        >
          <option value="">– auswählen –</option>
          {players.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.firstName} {pl.lastName}
              {pl.jugendName ? ` (${pl.jugendName})` : ""}
            </option>
          ))}
        </FloatingSelect>
        <FloatingInput
          label="Rolle (optional, z.B. Mutter/Vater)"
          value={form.roleLabel}
          onChange={(e) => setForm((f) => ({ ...f, roleLabel: e.target.value }))}
        />
        <FloatingInput
          label="E-Mail (optional)"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <FloatingInput
          label="Telefon (optional)"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <FloatingInput
          label="Notiz (optional)"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
          />
          Aktiv (nimmt an der Dienst-Rotation teil)
        </label>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-3">
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
      ) : parents.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Noch keine Eltern angelegt.</p>
      ) : (
        <div className="space-y-6">
          {[
            ...jugenden.map((j) => ({ key: j.id, title: j.name, parents: parents.filter((p) => p.jugendId === j.id) })),
            { key: "ohne-jugend", title: "Ohne Jugend", parents: parents.filter((p) => !p.jugendId) },
          ]
            .filter((group) => group.parents.length > 0)
            .map((group) => (
              <div key={group.key}>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{group.title}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Kontakt</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.parents.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{parentLabel(p)}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                            {[p.email, p.phone].filter(Boolean).join(" · ") || "–"}
                          </td>
                          <td className="px-4 py-2">
                            {p.active ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                aktiv
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                inaktiv
                              </span>
                            )}
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
