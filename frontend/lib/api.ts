export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

export const subjects = [
  "\u6570\u5b66",
  "\u82f1\u8a9e",
  "\u56fd\u8a9e",
  "\u7406\u79d1",
  "\u793e\u4f1a",
  "\u60c5\u5831",
  "\u305d\u306e\u4ed6",
];

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });

  if (!response.ok) {
    let detail = "\u901a\u4fe1\u306b\u5931\u6557\u3057\u307e\u3057\u305f";
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {}
    throw new Error(Array.isArray(detail) ? "\u5165\u529b\u5185\u5bb9\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044" : detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}
