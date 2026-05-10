import { apiBaseUrl } from "../api/client";
import type { AuthSession, LoginInput, RegisterInput } from "./types";
import { clearSession, persistSession } from "./localAuth";

async function authenticate(input: LoginInput): Promise<AuthSession> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/local/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      password: input.password ?? "",
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail ?? "No se pudo iniciar sesion beta.");
  }

  const session = payload as AuthSession;
  persistSession(session);
  return session;
}

export function loadApiSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem("praevia.auth.session.v1");
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    return session.accessToken ? session : null;
  } catch {
    clearSession();
    return null;
  }
}

export function loginApi(input: LoginInput) {
  return authenticate(input);
}

export function registerApi(input: RegisterInput) {
  return authenticate(input);
}
