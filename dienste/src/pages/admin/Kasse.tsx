import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { Tournament } from "../../lib/types";
import { FloatingSelect } from "../../components/FloatingField";
import { TournamentCashBox } from "../../components/TournamentCashBox";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function Kasse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Tournament[]>("/api/tournaments")
      .then((all) => setTournaments(all.filter((t) => t.type === "home")))
      .catch((err) => setError(err instanceof Error ? err.message : "Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, []);

  const selectedId = searchParams.get("turnier") ?? "";
  const selected = tournaments.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Kasse</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Veranstaltungskasse für ein Heimturnier – Turnier auswählen, um Anfangsbestand sowie Einnahmen und
          Ausgaben zu erfassen.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>
      ) : tournaments.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Noch keine Heimturniere angelegt. Unter „Turniere" ein Heimturnier anlegen, um hier eine Kasse zu
          führen.
        </p>
      ) : (
        <>
          <div className="max-w-md">
            <FloatingSelect
              label="Turnier"
              value={selectedId}
              onChange={(e) => setSearchParams(e.target.value ? { turnier: e.target.value } : {})}
            >
              <option value="">– auswählen –</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {formatDate(t.eventDate)} – {t.name}
                  {t.jugendName ? ` (${t.jugendName})` : ""}
                </option>
              ))}
            </FloatingSelect>
          </div>

          {selected && <TournamentCashBox tournamentId={selected.id} eventDate={selected.eventDate} />}
        </>
      )}
    </div>
  );
}
