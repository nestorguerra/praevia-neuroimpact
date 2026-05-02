export const apiBaseUrl = (import.meta.env.VITE_API_PUBLIC_URL as string | undefined) ?? "http://localhost:8000";

export class ApiFetchError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || `API ${status}`);
    this.name = "ApiFetchError";
    this.status = status;
    this.detail = detail;
  }
}

function headers(accessToken: string, init?: RequestInit) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...init?.headers,
  };
}

export async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: headers(accessToken, init),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");
  if (!response.ok) {
    const detail = typeof payload === "string"
      ? payload
      : payload?.detail ?? payload?.message ?? JSON.stringify(payload);
    throw new ApiFetchError(response.status, detail);
  }
  return payload as T;
}

export function apiErrorMessage(error: unknown, fallback = "No se pudo completar la operacion.") {
  if (error instanceof ApiFetchError) return error.detail || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}
