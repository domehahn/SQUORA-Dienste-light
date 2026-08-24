import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import {
  TOURNAMENT_TYPE_LABELS,
  parentLabel,
  type DutyType,
  type FairnessRow,
  type Parent,
  type Player,
  type TournamentDetail as TournamentDetailT,
} from "../../lib/types";
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [fairness, setFairness] = useState<FairnessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [newDutyTypeId, setNewDutyTypeId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("");
  const [autoAssigning, setAutoAssigning] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [t, dt, p, pl, f] = await Promise.all([
        api.get<TournamentDetailT>(`/api/tournaments/${id}`),
        api.get<DutyType[]>("/api/duty-types"),
        api.get<Parent[]>("/api/parents"),
        api.get<Player[]>("/api/players"),
        api.get<FairnessRow[]>("/api/fairness"),
      ]);
      setTournament(t);
      setDutyTypes(dt);
      setParents(p);
      setPlayers(pl);
      setFairness(f);
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
  const activeParents = parents.filter(
    (p) =>
      p.active &&
      (!tournament.jugendId || p.jugendId === tournament.jugendId) &&
      (tournament.availablePlayerIds.length === 0 ||
        (p.playerId !== null && tournament.availablePlayerIds.includes(p.playerId)))
  );
  const assignedParentIds = new Set(tournament.slots.filter((s) => s.assignment).map((s) => s.assignment!.parentId));
  const jugendPlayers = players
    .filter((p) => !tournament.jugendId || p.jugendId === tournament.jugendId)
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  const fairnessByParent = new Map(fairness.map((f) => [f.parentId, f]));
  // Wie oft hat dieses Elternteil diesen Dienst-Typ bereits übernommen -
  // Grundlage für die Sortierung/Warnung, dieselbe Kennzahl wie beim
  // automatischen Zuteilen.
  function dutyCount(parentId: string, dutyTypeId: string): number {
    return fairnessByParent.get(parentId)?.byDutyType[dutyTypeId] ?? 0;
  }
  // Gesamtzahl aller bisherigen Dienste (dienstartübergreifend, z.B. Dienst
  // + Wäsche zusammen) - für die Anzeige aussagekräftiger als der Zähler
  // einer einzelnen Dienst-Art, der zwischen den Slot-Dropdowns sonst
  // widersprüchlich wirkt.
  function totalCount(parentId: string): number {
    return fairnessByParent.get(parentId)?.total ?? 0;
  }

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
        time: newTime || null,
        sortOrder: 0,
      });
      setNewLabel("");
      setNewTime("");
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

  async function handleAssign(slotId: string, parentId: string, dutyTypeId: string, candidates: Parent[]) {
    setError(null);
    if (parentId !== "") {
      const chosenCount = dutyCount(parentId, dutyTypeId);
      const minCount = Math.min(...candidates.map((p) => dutyCount(p.id, dutyTypeId)));
      if (chosenCount > minCount) {
        const fairer = candidates
          .filter((p) => p.id !== parentId && dutyCount(p.id, dutyTypeId) === minCount)
          .map((p) => parentLabel(p));
        const proceed = confirm(
          `${parentLabel(parents.find((p) => p.id === parentId)!)} hat diesen Dienst schon ${chosenCount}x gemacht. ` +
            `${fairer.length > 0 ? `Fairer wäre z.B.: ${fairer.slice(0, 3).join(", ")}.` : "Es gibt Eltern, die ihn noch nie gemacht haben."} ` +
            `Trotzdem zuteilen?`
        );
        if (!proceed) return;
      }
    }
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

  async function handleConfirm(slotId: string) {
    setError(null);
    try {
      await api.put(`/api/slots/${slotId}/assignment/confirm`, {});
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Bestätigung");
    }
  }

  async function handleReject(slotId: string) {
    setError(null);
    try {
      await api.put(`/api/slots/${slotId}/assignment`, { parentId: null });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Ablehnen");
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

  async function handleToggleAvailable(playerId: string) {
    if (!tournament) return;
    setError(null);
    const next = tournament.availablePlayerIds.includes(playerId)
      ? tournament.availablePlayerIds.filter((id) => id !== playerId)
      : [...tournament.availablePlayerIds, playerId];
    try {
      await api.put(`/api/tournaments/${id}/available-players`, { playerIds: next });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern der Verfügbarkeit");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/turniere"
            className="text-sm text-blue-700 hover:underline dark:text-blue-400 print:hidden"
          >
            ← Zurück zu den Turnieren
          </Link>
          <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{tournament.name}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDate(tournament.eventDate)}
            {tournament.eventTime ? ` · ${tournament.eventTime} Uhr` : ""} · {TOURNAMENT_TYPE_LABELS[tournament.type]}
            {tournament.location ? ` · ${tournament.location}` : ""}
            {tournament.jugendName ? ` · ${tournament.jugendName}` : ""}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 print:hidden"
        >
          🖨️ Dienstliste drucken
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 print:hidden">Fehler: {error}</p>}
      {info && <p className="text-sm text-blue-700 dark:text-blue-400 print:hidden">{info}</p>}

      {/* Nur beim Drucken sichtbar: schlanke, reine Liste ohne Formulare/
          Steuerelemente - genau das, was am Turnier ausgehängt werden soll. */}
      {tournament.slots.length > 0 && (
        <table className="hidden w-full border-collapse text-sm print:table">
          <thead>
            <tr>
              <th className="border border-slate-400 px-2 py-1 text-left">Uhrzeit</th>
              <th className="border border-slate-400 px-2 py-1 text-left">Dienst</th>
              <th className="border border-slate-400 px-2 py-1 text-left">Zugeteilt an</th>
            </tr>
          </thead>
          <tbody>
            {tournament.slots.map((slot) => (
              <tr key={slot.id}>
                <td className="border border-slate-400 px-2 py-1">{slot.time ?? "–"}</td>
                <td className="border border-slate-400 px-2 py-1">
                  {slot.dutyTypeName}
                  {slot.label ? ` – ${slot.label}` : ""}
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  {slot.assignment
                    ? `${slot.assignment.parentName}${slot.assignment.status === "pending" ? " (angefragt)" : ""}`
                    : "offen"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {jugendPlayers.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 print:hidden">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Verfügbare Kinder</h3>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              {tournament.availablePlayerIds.length} von {jugendPlayers.length} ausgewählt
            </span>
          </div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Nur bei diesem Turnier dabei? Dann hier anklicken – die Dienst-Zuteilung berücksichtigt danach
            ausschließlich deren Eltern. Ohne Auswahl kommen alle Eltern der Jugend infrage.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {jugendPlayers.map((p) => {
              const available = tournament.availablePlayerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleToggleAvailable(p.id)}
                  aria-pressed={available}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    available
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {p.firstName} {p.lastName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 print:hidden">
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
              const options = activeParents
                .filter((p) => p.id === currentParentId || !assignedParentIds.has(p.id))
                .slice()
                .sort(
                  (a, b) =>
                    dutyCount(a.id, slot.dutyTypeId) - dutyCount(b.id, slot.dutyTypeId) ||
                    (fairnessByParent.get(a.id)?.total ?? 0) - (fairnessByParent.get(b.id)?.total ?? 0)
                );
              const isPending = slot.assignment?.status === "pending";
              return (
                <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {slot.time ? `${slot.time} · ` : ""}
                      {slot.dutyTypeName}
                      {slot.label ? ` – ${slot.label}` : ""}
                    </span>
                    {isPending && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                          Angefragt – wartet auf Bestätigung
                        </span>
                        {slot.assignment?.note && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">„{slot.assignment.note}“</span>
                        )}
                        <button
                          onClick={() => handleConfirm(slot.id)}
                          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Bestätigen
                        </button>
                        <button
                          onClick={() => handleReject(slot.id)}
                          className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          Ablehnen
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={currentParentId}
                      onChange={(e) => handleAssign(slot.id, e.target.value, slot.dutyTypeId, options)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">– offen –</option>
                      {options.map((p) => {
                        const count = totalCount(p.id);
                        return (
                          <option key={p.id} value={p.id}>
                            {parentLabel(p)} — {count === 0 ? "noch nicht gemacht" : `insgesamt ${count}x gemacht`}
                          </option>
                        );
                      })}
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
          <div className="w-32">
            <FloatingInput
              label="Uhrzeit (optional)"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
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
