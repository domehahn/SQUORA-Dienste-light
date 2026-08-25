import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { parentLabel, type Parent, type ParentAssignmentHistoryEntry } from "../../lib/types";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

interface HistoryResponse {
  parent: Parent;
  history: ParentAssignmentHistoryEntry[];
}

export default function ParentDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<HistoryResponse>(`/api/parents/${id}/history`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>;
  if (!data) return <p className="text-sm text-red-600 dark:text-red-400">Elternteil nicht gefunden.</p>;

  const { parent, history } = data;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = history.filter((h) => h.eventDate >= today);
  const past = history.filter((h) => h.eventDate < today);

  function historyTable(entries: ParentAssignmentHistoryEntry[], emptyText: string) {
    if (entries.length === 0) {
      return <p className="text-sm text-slate-400 dark:text-slate-500">{emptyText}</p>;
    }
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Turnier</th>
              <th className="px-4 py-2 font-medium">Dienst</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((h) => (
              <tr key={h.assignmentId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                  {formatDate(h.eventDate)}
                  {h.eventTime ? ` · ${h.eventTime}` : ""}
                </td>
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                  <Link to={`/admin/turniere/${h.tournamentId}`} className="hover:underline">
                    {h.tournamentName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                  {h.slotTime ? `${h.slotTime} · ` : ""}
                  {h.dutyTypeName}
                  {h.label ? ` – ${h.label}` : ""}
                </td>
                <td className="px-4 py-2">
                  {h.status === "pending" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                      angefragt
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      bestätigt
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/eltern" className="text-sm text-blue-700 hover:underline dark:text-blue-400">
          ← Zurück zu den Eltern
        </Link>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{parentLabel(parent)}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {parent.jugendName ?? "Ohne Jugend"} · {[parent.email, parent.phone].filter(Boolean).join(" · ") || "Keine Kontaktdaten"}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-slate-900 dark:text-slate-100">Kommende Dienste</h3>
        {historyTable(upcoming, "Keine kommenden Dienste.")}
      </div>

      <div>
        <h3 className="mb-2 font-medium text-slate-900 dark:text-slate-100">Bisherige Dienste</h3>
        {historyTable(past, "Noch keine bisherigen Dienste.")}
      </div>
    </div>
  );
}
