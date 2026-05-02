import type { AuthSession, LoginInput, RegisterInput } from "./types";

const STORAGE_KEY = "praevia.auth.session.v1";

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomId}`;
}

function initialsFromName(nameOrEmail: string) {
  const clean = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0].replace(/[._-]/g, " ") : nameOrEmail;
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "PV";
}

function companyFromEmail(email: string) {
  const domain = email.split("@")[1] ?? "empresa.local";
  const company = domain.split(".")[0] ?? "Empresa";
  return company.charAt(0).toUpperCase() + company.slice(1);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createSession(input: RegisterInput): AuthSession {
  const userId = createId("user");
  const organizationId = createId("org");
  const organizationName = input.organizationName.trim() || import.meta.env.VITE_DEMO_ORGANIZATION_NAME || companyFromEmail(input.email);
  const userName = input.name.trim() || input.email.split("@")[0];

  return {
    user: {
      id: userId,
      name: userName,
      email: input.email.trim().toLowerCase(),
      initials: initialsFromName(userName),
    },
    organization: {
      id: organizationId,
      name: organizationName,
      slug: slugify(organizationName),
      credits: 142,
      plan: "Piloto corporativo",
      status: "Demo",
    },
    membership: {
      id: createId("mem"),
      userId,
      organizationId,
      role: "owner",
    },
    provider: "local",
    createdAt: new Date().toISOString(),
  };
}

export function loadSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function persistSession(session: AuthSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function registerLocal(input: RegisterInput) {
  const session = createSession(input);
  persistSession(session);
  return session;
}

export function loginLocal(input: LoginInput) {
  const email = input.email.trim().toLowerCase();
  const demoEmail = (import.meta.env.VITE_DEMO_LOGIN_EMAIL as string | undefined)?.trim().toLowerCase();
  const demoPassword = (import.meta.env.VITE_DEMO_LOGIN_PASSWORD as string | undefined)?.trim();

  if (demoEmail && email !== demoEmail) {
    throw new Error("Este entorno demo solo permite el usuario autorizado.");
  }

  if (demoPassword && input.password !== demoPassword) {
    throw new Error("Password incorrecto para el entorno demo.");
  }

  const current = loadSession();

  if (current?.user.email === email) {
    return current;
  }

  const session = createSession({
    name: email.split("@")[0].replace(/[._-]/g, " "),
    email,
    organizationName: import.meta.env.VITE_DEMO_ORGANIZATION_NAME || companyFromEmail(email),
  });
  persistSession(session);
  return session;
}
