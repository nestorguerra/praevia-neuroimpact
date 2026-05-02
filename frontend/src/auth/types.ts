export type UserRole = "owner" | "admin" | "analyst" | "viewer";

export type PraeviaUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

export type PraeviaOrganization = {
  id: string;
  name: string;
  slug: string;
  credits: number;
  plan: "Sprint 10" | "Piloto corporativo" | "Professional" | "Enterprise";
  status: "Activo" | "Piloto" | "Demo";
};

export type PraeviaMembership = {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
};

export type AuthSession = {
  user: PraeviaUser;
  organization: PraeviaOrganization;
  membership: PraeviaMembership;
  accessToken?: string;
  provider: "local" | "supabase";
  createdAt: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  password?: string;
  organizationName: string;
};

export type LoginInput = {
  email: string;
  password?: string;
};
