import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadApiSession, loginApi, registerApi } from "./apiAuth";
import { clearSession, loadSession, loginLocal, registerLocal } from "./localAuth";
import {
  hydrateSupabaseSession,
  isSupabaseConfigured,
  loadSupabaseSession,
  loginSupabase,
  recoverSupabasePassword,
  registerSupabase,
  supabase,
} from "./supabaseAuth";
import type { AuthSession, LoginInput, RegisterInput } from "./types";

type AuthContextValue = {
  session: AuthSession | null;
  authMode: "api" | "local" | "supabase";
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (input: LoginInput) => Promise<AuthSession | null>;
  register: (input: RegisterInput) => Promise<AuthSession | null>;
  recoverPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function configuredAuthMode(): "api" | "local" | "supabase" {
  const requested = (import.meta.env.VITE_AUTH_MODE as string | undefined)?.toLowerCase();
  if (requested === "api") return "api";
  if (requested === "local") return "local";
  if (requested === "supabase") return "supabase";
  return isSupabaseConfigured ? "supabase" : "local";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const authMode = configuredAuthMode();
  const [session, setSession] = useState<AuthSession | null>(() => {
    if (authMode === "api") return loadApiSession();
    if (authMode === "local") return loadSession();
    return null;
  });
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authMode !== "supabase") return undefined;
    let cancelled = false;
    setIsLoading(true);
    loadSupabaseSession()
      .then((nextSession) => {
        if (!cancelled) setSession(nextSession);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudo cargar la sesion.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const subscription = supabase?.auth.onAuthStateChange(async (_event, nextSupabaseSession) => {
      if (!nextSupabaseSession) {
        setSession(null);
        return;
      }
      try {
        setSession(await hydrateSupabaseSession(nextSupabaseSession));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo sincronizar la sesion.");
      }
    }).data.subscription;

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [authMode]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    authMode,
    isAuthenticated: Boolean(session),
    isLoading,
    error,
    async login(input) {
      setError(null);
      setIsLoading(true);
      try {
        const nextSession = authMode === "api"
          ? await loginApi(input)
          : authMode === "supabase"
            ? await loginSupabase(input)
            : loginLocal(input);
        setSession(nextSession);
        return nextSession;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo iniciar sesion.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    async register(input) {
      setError(null);
      setIsLoading(true);
      try {
        const nextSession = authMode === "api"
          ? await registerApi(input)
          : authMode === "supabase"
            ? await registerSupabase(input)
            : registerLocal(input);
        setSession(nextSession);
        return nextSession;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo crear la cuenta.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    async recoverPassword(email) {
      setError(null);
      if (authMode === "supabase") {
        await recoverSupabasePassword(email);
      }
    },
    async logout() {
      if (authMode === "supabase") {
        await supabase?.auth.signOut();
      } else {
        clearSession();
      }
      setSession(null);
    },
    clearError() {
      setError(null);
    },
  }), [authMode, error, isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
