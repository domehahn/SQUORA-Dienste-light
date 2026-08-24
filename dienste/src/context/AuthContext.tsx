import { useEffect, useMemo, useState, type ReactNode } from "react";
import { decodeJwt } from "jose";
import { api, clearToken, getToken, setToken } from "../lib/api";
import { AuthContext, type AuthState } from "./auth-context";
import type { Role } from "../lib/types";

interface TokenPayload {
  sub: string;
  email: string;
  name: string | null;
  exp?: number;
}

interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  jugendIds: string[];
}

const EMPTY: AuthState = {
  isAuthenticated: false,
  userEmail: null,
  userName: null,
  role: null,
  jugendIds: [],
  isAdmin: false,
};

// Schnelle, synchrone Basis-Herleitung aus dem JWT (kein Netzwerk-Roundtrip
// nötig, damit RequireAuth ohne Flackern sofort entscheiden kann). Rolle/
// Jugend-Zuordnung stehen NICHT im Token (können sich ändern, ohne dass sich
// der Nutzer neu anmeldet) und werden separat per /api/me nachgeladen.
function readState(token: string | null): AuthState {
  if (!token) return EMPTY;
  try {
    const payload = decodeJwt(token) as TokenPayload;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return EMPTY;
    return { ...EMPTY, isAuthenticated: true, userEmail: payload.email, userName: payload.name };
  } catch {
    return EMPTY;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => readState(getToken()));

  async function refreshProfile() {
    if (!getToken()) return;
    try {
      const me = await api.get<MeResponse>("/api/me");
      setState((s) => ({
        ...s,
        isAuthenticated: true,
        userEmail: me.email,
        userName: me.name,
        role: me.role,
        jugendIds: me.jugendIds,
        isAdmin: me.role === "admin",
      }));
    } catch {
      clearToken();
      setState(EMPTY);
    }
  }

  useEffect(() => {
    refreshProfile();
    function onStorage() {
      setState(readState(getToken()));
      refreshProfile();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      async signIn(email: string, password: string) {
        try {
          const res = await api.post<{ token: string }>("/api/login", { email, password });
          setToken(res.token);
          setState(readState(res.token));
          await refreshProfile();
          return {};
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Anmeldung fehlgeschlagen" };
        }
      },
      signOut() {
        clearToken();
        setState(EMPTY);
      },
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
