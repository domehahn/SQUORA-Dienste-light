import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { DutyType, FairnessRow, Jugend } from "../../lib/types";
import { FloatingInput } from "../../components/FloatingField";

export default function Overview() {
  const [rows, setRows] = useState<FairnessRow[]>([]);
  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [jugenden, setJugenden] = useState<Jugend[]>([]);
  const [jugendFilter, setJugendFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [fairness, types, j] = await Promise.all([
          api.get<FairnessRow[]>("/api/fairness"),
          api.get<DutyType[]>("/api/duty-types"),
          api.get<Jugend[]>("/api/jugenden"),
        ]);
        setRows(fairness.sort((a, b) => a.total - b.total));
        setDutyTypes(types);
        setJugenden(j);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const jugendFilteredRows = rows.filter((r) => jugendFilter === "all" || r.jugendId === jugendFilter);
  // Nur Dienst-Arten als Spalten zeigen, die im aktuellen Jugend-Filter auch
  // tatsächlich schon mal vergeben wurden - sonst wirkt die Tabelle bei
  // vielen konfigurierten, aber (noch) ungenutzten Dienst-Arten überladen.
  const usedDutyTypes = dutyTypes.filter((d) => jugendFilteredRows.some((r) => (r.byDutyType[d.id] ?? 0) > 0));
  const visibleRows = jugendFilteredRows.filter((r) =>
    r.parentName.toLowerCase().includes(search.trim().toLowerCase())
  );
  const filterLabel =
    (jugendFilter === "all" ? "Alle Jugenden" : jugenden.find((j) => j.id === jugendFilter)?.name ?? "") +
    (search.trim() ? ` · Suche: „${search.trim()}“` : "");

  // Gesamtzahl je Dienst-Art (und insgesamt) über die gerade angezeigten
  // Zeilen - bezieht sich auf denselben gefilterten/gesuchten Ausschnitt wie
  // die Tabelle selbst.
  const totalByDutyType = Object.fromEntries(
    usedDutyTypes.map((d) => [d.id, visibleRows.reduce((sum, r) => sum + (r.byDutyType[d.id] ?? 0), 0)])
  );
  const grandTotal = visibleRows.reduce((sum, r) => sum + r.total, 0);

  function handleExportCsv() {
    // Semikolon statt Komma als Trenner (deutsches Excel erwartet das
    // standardmäßig) + UTF-8-BOM, damit Umlaute in der Elternbezeichnung
    // korrekt angezeigt werden.
    function csvField(value: string | number): string {
      const text = String(value);
      return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }
    const header = ["Elternteil", "Gesamt", ...usedDutyTypes.map((d) => d.name)];
    const lines = [
      header.map(csvField).join(";"),
      ...visibleRows.map((r) =>
        [r.parentName + (r.active ? "" : " (inaktiv)"), r.total, ...usedDutyTypes.map((d) => r.byDutyType[d.id] ?? 0)]
          .map(csvField)
          .join(";")
      ),
      ["Gesamt", grandTotal, ...usedDutyTypes.map((d) => totalByDutyType[d.id])].map(csvField).join(";"),
    ];
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uebersicht-${jugendFilter === "all" ? "alle" : filterLabel.split(" · ")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Übersicht</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Wie oft war jedes Elternteil bereits eingeteilt – aufsteigend sortiert, wer am wenigsten Dienste hatte,
            steht oben. Grundlage für eine faire Verteilung, auch bei manueller Zuteilung.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handleExportCsv}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ⬇️ CSV exportieren
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            🖨️ Übersicht drucken
          </button>
        </div>
      </div>

      {jugenden.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 print:hidden">
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

      <div className="max-w-xs print:hidden">
        <FloatingInput
          label="Elternteil suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 print:hidden">Fehler: {error}</p>}

      {/* Nur beim Drucken sichtbar: schlanke, immer helle Tabelle (unabhängig
          vom Darkmode - sonst wäre der Text auf Papier unlesbar) mit Kontext
          (aktiver Jugend-Filter), da auf Papier keine Überschrift/Filter mehr
          sichtbar sind. */}
      {!loading && visibleRows.length > 0 && (
        <div className="hidden print:block">
          <h3 className="mb-2 font-semibold text-slate-900">Übersicht – {filterLabel}</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-400 px-2 py-1 text-left">Elternteil</th>
                <th className="border border-slate-400 px-2 py-1 text-left">Gesamt</th>
                {usedDutyTypes.map((d) => (
                  <th key={d.id} className="border border-slate-400 px-2 py-1 text-left">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.parentId}>
                  <td className="border border-slate-400 px-2 py-1">
                    {r.parentName}
                    {!r.active ? " (inaktiv)" : ""}
                  </td>
                  <td className="border border-slate-400 px-2 py-1">{r.total}</td>
                  {usedDutyTypes.map((d) => (
                    <td key={d.id} className="border border-slate-400 px-2 py-1">
                      {r.byDutyType[d.id] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="border border-slate-400 px-2 py-1">Gesamt</td>
                <td className="border border-slate-400 px-2 py-1">{grandTotal}</td>
                {usedDutyTypes.map((d) => (
                  <td key={d.id} className="border border-slate-400 px-2 py-1">
                    {totalByDutyType[d.id]}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2 font-medium">Elternteil</th>
                <th className="px-4 py-2 font-medium">Gesamt</th>
                {usedDutyTypes.map((d) => (
                  <th key={d.id} className="px-4 py-2 font-medium">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
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
                  {usedDutyTypes.map((d) => (
                    <td key={d.id} className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {r.byDutyType[d.id] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={2 + usedDutyTypes.length} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    {search.trim() ? "Kein Elternteil gefunden." : "Noch keine Eltern angelegt."}
                  </td>
                </tr>
              )}
            </tbody>
            {visibleRows.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100">
                <tr>
                  <td className="px-4 py-2">Gesamt</td>
                  <td className="px-4 py-2">{grandTotal}</td>
                  {usedDutyTypes.map((d) => (
                    <td key={d.id} className="px-4 py-2">
                      {totalByDutyType[d.id]}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
