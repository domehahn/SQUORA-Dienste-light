import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { DutyType, FairnessRow } from "../../lib/types";

export default function Overview() {
  const [rows, setRows] = useState<FairnessRow[]>([]);
  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [fairness, types] = await Promise.all([
          api.get<FairnessRow[]>("/api/fairness"),
          api.get<DutyType[]>("/api/duty-types"),
        ]);
        setRows(fairness.sort((a, b) => a.total - b.total));
        setDutyTypes(types);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Übersicht</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Wie oft war jedes Elternteil bereits eingeteilt – aufsteigend sortiert, wer am wenigsten Dienste hatte,
          steht oben. Grundlage für eine faire Verteilung, auch bei manueller Zuteilung.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2 font-medium">Elternteil</th>
                <th className="px-4 py-2 font-medium">Gesamt</th>
                {dutyTypes.map((d) => (
                  <th key={d.id} className="px-4 py-2 font-medium">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.parentId} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                    {r.parentName}
                    {!r.active && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        inaktiv
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.total}</td>
                  {dutyTypes.map((d) => (
                    <td key={d.id} className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {r.byDutyType[d.id] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={2 + dutyTypes.length} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    Noch keine Eltern angelegt.
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
