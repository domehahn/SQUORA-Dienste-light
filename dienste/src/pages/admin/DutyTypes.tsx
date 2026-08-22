import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { APPLIES_TO_LABELS, type DutyApplicability, type DutyType } from "../../lib/types";
import { FloatingInput, FloatingSelect } from "../../components/FloatingField";

export default function DutyTypes() {
  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState<DutyApplicability>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setDutyTypes(await api.get<DutyType[]>("/api/duty-types"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(d: DutyType) {
    setEditingId(d.id);
    setName(d.name);
    setAppliesTo(d.appliesTo);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setAppliesTo("home");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = { name, appliesTo, sortOrder: 0 };
      if (editingId) await api.put(`/api/duty-types/${editingId}`, payload);
      else await api.post("/api/duty-types", payload);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Dienst-Art wirklich löschen?")) return;
    try {
      await api.del(`/api/duty-types/${id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dienst-Arten</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Katalog der Dienste, z.B. Grillen, Bonkasse, Kuchenverkauf, Pommes, Getränke, Trikotwäsche. Trikotwäsche
          fällt typischerweise bei Heim- <em>und</em> Auswärtsturnieren an.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="min-w-[160px] flex-1">
          <FloatingInput label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-56">
          <FloatingSelect
            label="Gilt für"
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value as DutyApplicability)}
          >
            {Object.entries(APPLIES_TO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FloatingSelect>
        </div>
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
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Gilt für</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {dutyTypes.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{d.name}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{APPLIES_TO_LABELS[d.appliesTo]}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => startEdit(d)}
                      className="mr-3 text-sm text-blue-700 hover:underline dark:text-blue-400"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="text-sm text-red-600 hover:underline dark:text-red-400"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
              {dutyTypes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    Noch keine Dienst-Arten angelegt.
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
