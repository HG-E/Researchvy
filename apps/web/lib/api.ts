// apps/web/lib/api.ts
// Typed API client — wraps fetch with auth headers and error handling.
// Used by all data-fetching hooks and server actions.

import type { ApiResponse, AuthResponse, DashboardData, LoginRequest, RegisterRequest } from "@researchvy/shared";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TOKEN_KEY = "rv_token";

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN MANAGEMENT
// Stored in a cookie (not localStorage) — survives page refresh,
// accessible to middleware for SSR auth checks.
// ─────────────────────────────────────────────────────────────────────────────

export const tokenStore = {
  get: () => Cookies.get(TOKEN_KEY) ?? null,
  set: (token: string) => Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: "lax" }),
  clear: () => Cookies.remove(TOKEN_KEY),
};

// ─────────────────────────────────────────────────────────────────────────────
// BASE FETCH
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = tokenStore.get();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json() as ApiResponse<T>;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export const auth = {
  register: (body: RegisterRequest) =>
    apiFetch<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: LoginRequest) =>
    apiFetch<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => apiFetch<{ user: { id: string; email: string; name: string; role: string } }>("/api/v1/auth/me"),

  logout: async () => {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    tokenStore.clear();
  },

  // Returns the URL to redirect to for ORCID OAuth
  orcidConnectUrl: () => `${API_URL}/api/v1/auth/orcid`,
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export const dashboard = {
  get: () => apiFetch<DashboardData>("/api/v1/dashboard"),
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const publications = {
  list: (params?: { page?: number; pageSize?: number; sortBy?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch(`/api/v1/publications${qs ? `?${qs}` : ""}`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VISIBILITY
// ─────────────────────────────────────────────────────────────────────────────

export const visibility = {
  latest: () => apiFetch("/api/v1/visibility/latest"),
  history: () => apiFetch("/api/v1/visibility/history"),
  compute: () => apiFetch("/api/v1/visibility/compute", { method: "POST" }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SYNC
// ─────────────────────────────────────────────────────────────────────────────

export const sync = {
  trigger: (source: "ORCID" | "OPEN_ALEX" | "SEMANTIC_SCHOLAR") =>
    apiFetch("/api/v1/sync/trigger", {
      method: "POST",
      body: JSON.stringify({ source }),
    }),

  status: () => apiFetch("/api/v1/sync/status"),
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export const profile = {
  get: () => apiFetch("/api/v1/researchers/me"),
  update: (data: Record<string, unknown>) =>
    apiFetch("/api/v1/researchers/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};
