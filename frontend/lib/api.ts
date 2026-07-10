export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

export const subjects = [
  "テクノロジ系",
  "アルゴリズム",
  "データベース",
  "ネットワーク",
  "セキュリティ",
  "マネジメント系",
  "ストラテジ系",
];

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });

  if (!response.ok) {
    let detail = "通信に失敗しました";
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {}
    throw new Error(Array.isArray(detail) ? "入力内容を確認してください" : detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}
