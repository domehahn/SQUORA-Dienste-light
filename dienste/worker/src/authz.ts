import type { Role } from "./types";

// Admins haben immer Zugriff. Trainer nur auf ihre zugeordnete(n) Jugend(en) -
// eine Ressource ohne Jugend-Zuordnung ist für Trainer grundsätzlich tabu
// (Admin-Territorium), damit die Datentrennung lückenlos bleibt.
export function canAccessJugend(role: Role, allowedJugendIds: string[], jugendId: string | null): boolean {
  if (role === "admin") return true;
  return jugendId !== null && allowedJugendIds.includes(jugendId);
}
