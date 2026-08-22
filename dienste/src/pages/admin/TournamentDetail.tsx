import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { TOURNAMENT_TYPE_LABELS, type DutyType, type Parent, type TournamentDetail as TournamentDetailT } from "../../lib/types";
import { FloatingSelect, FloatingInput } from "../../components/FloatingField";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<TournamentDetailT | null>(null);
  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [newDutyTypeId, setNewDutyTypeId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [autoAssigning, setAutoAssigning] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [t, dt, p] = await Promise.all([
        api.get<TournamentDetailT>(`/api/tournaments/${id}`),
        api.get<DutyType[]>("/api/duty-types"),
        api.get<Parent[]>("/api/parents"),
      ]);
      setTournament(t);
      setDutyTypes(dt);
      setParents(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>;
  if (!tournament) return <p className="text-sm text-red-600 dark:text-red-400">Turnier nicht gefunden.</p>;

  const applicableDutyTypes = dutyTypes.filter(
    (d) => d.appliesTo === "both" || d.appliesTo === tournament.type
  );
  const activeParents = parents.filter((p) => p.active);
  const assignedParentIds = new Set(tournament.slots.filter((s) => s.assignment).map((s) => s.assignment!.parentId));

  async function handleAddSlot(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newDutyTypeId) {
      setError("Bitte eine Dienst-Art auswählen");
      return;
    }
    try {
      await api.post(`/api/tournaments/${id}/slots`, {
        dutyTypeId: newDutyTypeId,
        label: newLabel || null,
        sortOrder: 0,
      });
      setNewLabel("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Anlegen des Dienst-Slots");
    }
  }

  async function handleDeleteSlot(slotId: string) {
    if (!confirm("Diesen Dienst-Slot wirklich löschen?")) return;
    setError(null);
    try {
      await api.del(`/api/slots/${slotId}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  async function handleAssign(slotId: string, parentId: string) {
    setError(null);
    try {
      if (parentId === "") {
        await api.put(`/api/slots/${slotId}/assignment`, { parentId: null });
      } else {
        await api.put(`/api/slots/${slotId}/assignment`, { parentId });
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Zuteilung");
    }
  }

  async function handleAutoAssign() {
    if (!id) return;
    setError(null);
    setInfo(null);
    setAutoAssigning(true);
    try {
      const result = await api.post<{ assigned: number; unfilled: string[] }>(
        `/api/tournaments/${id}/auto-assign`,
        {}
      );
      if (result.unfilled.length > 0) {
        setInfo(
          `${result.assigned} Dienst(e) automatisch zugeteilt. ${result.unfilled.length} Slot(s) konnten nicht besetzt werden (zu wenige aktive Eltern übrig).`
        );
      } else if (result.assigned > 0) {
        setInfo(`${result.assigned} Dienst(e) automatisch zugeteilt.`);
      } else {
        setInfo("Es gab keine offenen Dienste zum Zuteilen.");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der automatischen Zuteilung");
    } finally {
      setAutoAssigning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/turniere" className="text-sm text-blue-700 hover:underline dark:text-blue-400">
          ← Zurück zu den Turnieren
        </Link>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{tournament.name}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatDate(tournament.eventDate)} · {TOURNAMENT_TYPE_LABELS[tournament.type]}
          {tournament.location ? ` · ${tournament.location}` : ""}
        </p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
      {info && <p className="text-sm text-blue-700 dark:text-blue-400">{info}</p>}

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium text-slate-900 dark:text-slate-100">Dienst-Slots</h3>
          <button
            onClick={handleAutoAssign}
            disabled={autoAssigning}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {autoAssigning ? "Teilt zu…" : "Automatisch zuteilen"}
          </button>
        </div>

        {tournament.slots.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Noch keine Dienst-Slots angelegt.</p>
        ) : (
          <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-800">
            {tournament.slots.map((slot) => {
              const currentParentId = slot.assignment?.parentId ?? "";
              const options = activeParents.filter(
                (p) => p.id === currentParentId || !assignedParentIds.has(p.id)
              );
              return (
                <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {slot.dutyTypeName}
                    {slot.label ? ` – ${slot.label}` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={currentParentId}
                      onChange={(e) => handleAssign(slot.id, e.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">– offen –</option>
                      {options.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                          {p.childName ? ` (${p.childName})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="text-sm text-red-600 hover:underline dark:text-red-400"
                    >
                      Löschen
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={handleAddSlot} className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="w-56">
            <FloatingSelect label="Dienst-Art" value={newDutyTypeId} onChange={(e) => setNewDutyTypeId(e.target.value)}>
              <option value="">– auswählen –</option>
              {applicableDutyTypes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </FloatingSelect>
          </div>
          <div className="min-w-[160px] flex-1">
            <FloatingInput
              label="Bezeichnung (optional, z.B. Frühschicht)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Slot hinzufügen
          </button>
        </form>
        {applicableDutyTypes.length === 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Für diese Turnierart ({TOURNAMENT_TYPE_LABELS[tournament.type]}) sind noch keine passenden Dienst-Arten
            angelegt. Unter „Dienst-Arten“ ergänzen.
          </p>
        )}
      </div>
    </div>
  );
}
