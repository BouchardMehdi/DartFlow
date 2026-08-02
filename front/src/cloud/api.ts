export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

let refreshRequest: Promise<boolean> | null = null;
export const SESSION_REFRESHED_EVENT = "dartflow:session-refreshed";

async function rawRequest(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`/api${path}`, { ...init, credentials: "include", headers });
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await rawRequest(path, init);
  const canRefresh = response.status === 401 && !["/auth/login", "/auth/register", "/auth/refresh"].includes(path);
  if (canRefresh) {
    refreshRequest ??= rawRequest("/auth/refresh", { method: "POST" }).then(async (result) => { if (!result.ok) return false; const payload = await result.json() as { accessExpiresAt?: string }; if (payload.accessExpiresAt && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SESSION_REFRESHED_EVENT, { detail: payload.accessExpiresAt })); return true; }).catch(() => false).finally(() => { refreshRequest = null; });
    if (await refreshRequest) response = await rawRequest(path, init);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(body?.message ?? "Le serveur est momentanément indisponible.", response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
