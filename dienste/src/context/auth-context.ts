import { createContext } from "react";
import type { Role } from "../lib/types";

export interface AuthState {
  isAuthenticated: boolean;
  userEmail: string | null;
  userName: string | null;
  role: Role | null;
  jugendIds: string[];
  isAdmin: boolean;
}

export interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
