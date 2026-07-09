"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const links = [
    ["/dashboard", "ホーム"],
    ["/study", "学習記録"],
    ["/ai/problems", "AI問題"],
    ["/analysis", "分析"],
    ["/schedule", "予定"],
    ["/ocr", "画像解説"],
    ["/goals", "目標"],
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="text-xl font-bold text-ink">
            StudyPilot
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold">
            {links.map(([href, label]) => (
              <Link
                key={href}
                className={`rounded-md px-3 py-2 transition ${
                  pathname === href ? "bg-focus text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
                href={href}
              >
                {label}
              </Link>
            ))}
            <button className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100" onClick={logout}>
              ログアウト
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
