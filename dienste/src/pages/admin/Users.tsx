import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import type { AppUser, Jugend, Role } from "../../lib/types";
import { FloatingInput, FloatingSelect } from "../../components/FloatingField";

const ROLE_LABELS: Record<Role, string> = { admin: "Admin", trainer: "Trainer" };

const EMPTY = { email: "", name: "", password: "", role: "trainer" as Role, jugendIds: [] as string[] };

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [jugenden, setJugenden] = useState<Jugend[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [u, j] = await Promise.all([
        api.get<AppUser[]>("/api/users"),
        api.get<Jugend[]>("/api/jugenden"),
      ]);
      setUsers(u);
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

  function startEdit(u: AppUser) {
    setEditingId(u.id);
    setForm({ email: u.email, name: u.name ?? "", password: "", role: u.role, jugendIds: u.jugendIds });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
  }

  function toggleJugend(id: string) {
    setForm((f) => ({
      ...f,
      jugendIds: f.jugendIds.includes(id) ? f.jugendIds.filter((j) => j !== id) : [...f.jugendIds, id],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        const payload: Record<string, unknown> = { name: form.name || null, role: form.role, jugendIds: form.jugendIds };
        if (form.password) payload.password = form.password;
        await api.put(`/api/users/${editingId}`, payload);
      } else {
        await api.post("/api/users", {
          email: form.email,
          name: form.name || null,
          password: form.password,
          role: form.role,
          jugendIds: form.jugendIds,
        });
      }
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Nutzer wirklich löschen?")) return;
    try {
      await api.del(`/api/users/${id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Nutzer</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Admins sehen und verwalten alles. Trainer sehen nur ihre zugeordnete(n) Jugend(en) – Turniere,
          Spieler, Eltern, Übersicht – und können dort Meldungen freigeben.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FloatingInput
          label="E-Mail"
          type="email"
          required
          disabled={!!editingId}
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <FloatingInput
          label="Name (optional)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <FloatingInput
          label={editingId ? "Neues Passwort (optional)" : "Passwort"}
          type="password"
          required={!editingId}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
        <FloatingSelect
          label="Rolle"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FloatingSelect>
        {form.role === "trainer" && (
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Zugeordnete Jugend(en)
            </span>
            <div className="flex flex-wrap gap-3 rounded-md border border-slate-300 p-3 dark:border-slate-700">
              {jugenden.map((j) => (
                <label key={j.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.jugendIds.includes(j.id)}
                    onChange={() => toggleJugend(j.id)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
                  />
                  {j.name}
                </label>
              ))}
              {jugenden.length === 0 && (
                <span className="text-sm text-slate-400 dark:text-slate-500">Noch keine Jugenden angelegt.</span>
              )}
            </div>
          </div>
        )}
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
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2 font-medium">E-Mail</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Rolle</th>
                <th className="px-4 py-2 font-medium">Jugenden</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{u.email}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{u.name ?? "–"}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {u.role === "trainer"
                      ? jugenden
                          .filter((j) => u.jugendIds.includes(j.id))
                          .map((j) => j.name)
                          .join(", ") || "–"
                      : "alle"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => startEdit(u)}
                      className="mr-3 text-sm text-blue-700 hover:underline dark:text-blue-400"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-sm text-red-600 hover:underline dark:text-red-400"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    Noch keine Nutzer angelegt.
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
