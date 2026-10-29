const API_BASE = import.meta.env.VITE_API_BASE || "";

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  requestId?: string;

  constructor(status: number, message: string, code = "error", details: Record<string, unknown> = {}, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

/* The token each request sends is held by this page (set by AuthProvider), not read from browser
 * storage at send time. Other tabs sharing the same storage can sign out or clear it at any moment;
 * that must not make this page's requests go out without a token. */
let sessionToken: string | null = null;
let onUnauthorized: (path: string, reason: string, sentToken: string | null) => void = () => undefined;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

export function configureAuth(unauthorized: (path: string, reason: string, sentToken: string | null) => void): void {
  onUnauthorized = unauthorized;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const sentToken = sessionToken;
  if (sentToken) headers.set("Authorization", `Bearer ${sentToken}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}/api/v1${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const err = isJson ? payload?.error : null;
    // Wrong credentials also return 401 on the sign-in endpoints; only a rejected session signs out.
    if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
      onUnauthorized(path, err?.message || `HTTP ${response.status}`, sentToken);
    }
    throw new ApiError(
      response.status,
      err?.message || (typeof payload === "string" && payload) || `Request failed (${response.status})`,
      err?.code || "error",
      err?.details || {},
      err?.request_id,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  upload: <T>(path: string, form: FormData, idempotencyKey?: string) =>
    request<T>(path, { method: "POST", body: form, headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {} }),
  rawUrl: (path: string) => `${API_BASE}/api/v1${path}`,
};

export async function authenticatedBlob(path: string): Promise<Blob> {
  const token = sessionToken;
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new ApiError(response.status, "Could not load the document file.");
  return response.blob();
}
