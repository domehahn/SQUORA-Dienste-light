import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { TOURNAMENT_TYPE_LABELS, type TournamentDetail } from "../lib/types";
import { ThemeToggle } from "../components/ThemeToggle";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function Public() {
  const [tournaments, setTournaments] = useState<TournamentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  useEffect(() => {
    (async () => {
      try {
        setTournaments(await api.get<TournamentDetail[]>("/api/public/tournaments"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const visible = tournaments.filter((t) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return t.eventDate >= today;
    return t.eventDate < today;
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">📋 Dienste</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Admin-Login
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dienstplan</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Wer macht bei welchem Turnier welchen Dienst? Öffentlich einsehbar, ohne Anmeldung.
          </p>
        </div>

        <div className="flex gap-1">
          {(
            [
              { key: "upcoming", label: "Kommende" },
              { key: "past", label: "Vergangene" },
              { key: "all", label: "Alle" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                filter === opt.key
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Keine Turniere in dieser Ansicht.</p>
        ) : (
          <div className="space-y-4">
            {visible.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(t.eventDate)} · {TOURNAMENT_TYPE_LABELS[t.type]}
                      {t.location ? ` · ${t.location}` : ""}
                    </p>
                  </div>
                </div>
                {t.slots.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">Noch keine Dienste angelegt.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {t.slots.map((slot) => (
                      <li key={slot.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="text-slate-700 dark:text-slate-300">
                          {slot.dutyTypeName}
                          {slot.label ? ` – ${slot.label}` : ""}
                        </span>
                        <span
                          className={
                            slot.assignment
                              ? "font-medium text-slate-900 dark:text-slate-100"
                              : "text-amber-600 dark:text-amber-400"
                          }
                        >
                          {slot.assignment ? slot.assignment.parentName : "noch offen"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
