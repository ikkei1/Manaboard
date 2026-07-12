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

export const themePresets: Record<string, string[]> = {
  テクノロジ系: ["2進数", "論理演算", "稼働率", "補数", "CPUとメモリ"],
  アルゴリズム: ["探索", "整列", "流れ図", "疑似言語", "計算量"],
  データベース: ["SQL", "正規化", "主キー", "トランザクション", "ER図"],
  ネットワーク: ["TCP/IP", "IPアドレス", "DNS", "HTTP", "OSI参照モデル"],
  セキュリティ: ["暗号化", "認証", "マルウェア", "公開鍵基盤", "アクセス制御"],
  マネジメント系: ["プロジェクト管理", "サービス管理", "品質管理", "開発プロセス", "リスク管理"],
  ストラテジ系: ["経営戦略", "システム戦略", "法務", "企業会計", "業務分析"],
};

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
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : ""))
        .filter(Boolean);
      throw new Error(messages.join(" / ") || "入力内容を確認してください");
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export function todayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
