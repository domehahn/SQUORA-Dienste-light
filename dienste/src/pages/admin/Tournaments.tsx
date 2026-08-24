import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { TOURNAMENT_TYPE_LABELS, type Jugend, type Tournament, type TournamentType } from "../../lib/types";
import { FloatingInput, FloatingSelect } from "../../components/FloatingField";

const EMPTY = {
  name: "",
  type: "home" as TournamentType,
  eventDate: "",
  eventTime: "",
  location: "",
  notes: "",
  jugendId: "",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function Tournaments() {
  const { isAdmin } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [jugenden, setJugenden] = useState<Jugend[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [jugendFilter, setJugendFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    try {
      const [t, j] = await Promise.all([
        api.get<Tournament[]>("/api/tournaments"),
        api.get<Jugend[]>("/api/jugenden"),
      ]);
      setTournaments(t);
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

  function startEdit(t: Tournament) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      type: t.type,
      eventDate: t.eventDate,
      eventTime: t.eventTime ?? "",
      location: t.location ?? "",
      notes: t.notes ?? "",
      jugendId: t.jugendId ?? "",
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
        type: form.type,
        eventDate: form.eventDate,
        eventTime: form.eventTime || null,
        location: form.location || null,
        notes: form.notes || null,
        jugendId: form.jugendId || null,
      };
      if (editingId) await api.put(`/api/tournaments/${editingId}`, payload);
      else await api.post("/api/tournaments", payload);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Turnier wirklich löschen? Alle zugehörigen Dienste und Zuteilungen gehen verloren.")) return;
    try {
      await api.del(`/api/tournaments/${id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Turniere</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Heim- und Auswärtsturniere anlegen. Die Dienst-Slots und die Zuteilung der Eltern werden im
          Turnier-Detail verwaltet.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="sm:col-span-2">
          <FloatingInput
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <FloatingSelect
          label="Art"
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TournamentType }))}
        >
          {Object.entries(TOURNAMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FloatingSelect>
        <FloatingInput
          label="Datum"
          type="date"
          required
          value={form.eventDate}
          onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
        />
        <FloatingInput
          label="Uhrzeit (optional)"
          type="time"
          value={form.eventTime}
          onChange={(e) => setForm((f) => ({ ...f, eventTime: e.target.value }))}
        />
        <FloatingInput
          label="Ort (optional)"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <FloatingInput
            label="Notiz (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <FloatingSelect
          label={isAdmin ? "Jugend (optional)" : "Jugend"}
          required={!isAdmin}
          value={form.jugendId}
          onChange={(e) => setForm((f) => ({ ...f, jugendId: e.target.value }))}
        >
          {isAdmin && <option value="">– keine –</option>}
          {!isAdmin && <option value="">– auswählen –</option>}
          {jugenden.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </FloatingSelect>
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

      {jugenden.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setJugendFilter("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              jugendFilter === "all"
                ? "bg-blue-600 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Alle Jugenden
          </button>
          {jugenden.map((j) => (
            <button
              key={j.id}
              onClick={() => setJugendFilter(j.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                jugendFilter === j.id
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {j.name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2 font-medium">Datum</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Art</th>
                <th className="px-4 py-2 font-medium">Jugend</th>
                <th className="px-4 py-2 font-medium">Ort</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tournaments
                .filter((t) => jugendFilter === "all" || t.jugendId === jugendFilter)
                .map((t) => (
                <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {formatDate(t.eventDate)}
                    {t.eventTime ? ` · ${t.eventTime}` : ""}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                    <Link to={`/admin/turniere/${t.id}`} className="hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{TOURNAMENT_TYPE_LABELS[t.type]}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{t.jugendName ?? "–"}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{t.location ?? "–"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/admin/turniere/${t.id}`}
                      className="mr-3 text-sm text-blue-700 hover:underline dark:text-blue-400"
                    >
                      Dienste
                    </Link>
                    <button
                      onClick={() => startEdit(t)}
                      className="mr-3 text-sm text-blue-700 hover:underline dark:text-blue-400"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-sm text-red-600 hover:underline dark:text-red-400"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
              {tournaments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    Noch keine Turniere angelegt.
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
