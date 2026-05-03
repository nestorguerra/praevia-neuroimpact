import { createClient, type Session } from "@supabase/supabase-js";
import type { AuthSession, LoginInput, PraeviaOrganization, RegisterInput, UserRole } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null;

function initialsFromName(nameOrEmail: string) {
  const clean = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0].replace(/[._-]/g, " ") : nameOrEmail;
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PV";
}

function normalizePlan(value?: string): PraeviaOrganization["plan"] {
  if (value === "Piloto corporativo" || value === "Professional" || value === "Enterprise") return value;
  return "Piloto creativo";
}

function normalizeStatus(value?: string): PraeviaOrganization["status"] {
  if (value === "Activo" || value === "Piloto" || value === "Demo") return value;
  if (value === "active") return "Activo";
  if (value === "pilot") return "Piloto";
  return "Demo";
}

function assertConfigured() {
  if (!supabase) {
    throw new Error("Supabase Auth no esta configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
}

export async function hydrateSupabaseSession(session: Session): Promise<AuthSession> {
  const client = assertConfigured();
  const user = session.user;
  const profileResult = await client
    .from("profiles")
    .select("id,email,full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResult.error) throw profileResult.error;

  const membershipResult = await client
    .from("memberships")
    .select("id,organization_id,user_id,role,organizations(id,name,slug,credits,plan,status)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipResult.error) throw membershipResult.error;
  if (!membershipResult.data) {
    throw new Error("Usuario autenticado sin organizacion asociada. Revisa el trigger handle_new_user en Supabase.");
  }

  const organizationRaw = membershipResult.data.organizations as unknown;
  const organization = Array.isArray(organizationRaw) ? organizationRaw[0] : organizationRaw;
  if (!organization || typeof organization !== "object") {
    throw new Error("La membresia no tiene organizacion asociada.");
  }

  const org = organization as {
    id: string;
    name: string;
    slug: string;
    credits: number;
    plan?: string;
    status?: string;
  };
  const profile = profileResult.data;
  const name = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario PraevIA";
  const email = profile?.email || user.email || "";

  return {
    user: {
      id: user.id,
      name,
      email,
      initials: initialsFromName(name || email),
    },
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      credits: org.credits,
      plan: normalizePlan(org.plan),
      status: normalizeStatus(org.status),
    },
    membership: {
      id: membershipResult.data.id,
      userId: user.id,
      organizationId: org.id,
      role: membershipResult.data.role as UserRole,
    },
    accessToken: session.access_token,
    provider: "supabase",
    createdAt: new Date().toISOString(),
  };
}

export async function loadSupabaseSession(): Promise<AuthSession | null> {
  const client = assertConfigured();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  return hydrateSupabaseSession(data.session);
}

export async function loginSupabase(input: LoginInput): Promise<AuthSession> {
  const client = assertConfigured();
  const { data, error } = await client.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password ?? "",
  });
  if (error) throw error;
  if (!data.session) throw new Error("Login correcto pero sin sesion activa.");
  return hydrateSupabaseSession(data.session);
}

export async function registerSupabase(input: RegisterInput): Promise<AuthSession | null> {
  const client = assertConfigured();
  const { data, error } = await client.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password ?? "",
    options: {
      data: {
        full_name: input.name.trim(),
        organization_name: input.organizationName.trim(),
      },
    },
  });
  if (error) throw error;
  if (!data.session) return null;
  return hydrateSupabaseSession(data.session);
}

export async function recoverSupabasePassword(email: string) {
  const client = assertConfigured();
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/login`,
  });
  if (error) throw error;
}
