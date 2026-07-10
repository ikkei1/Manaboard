"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const links = [
    ["/dashboard", "ホーム"],
    ["/study", "学習記録"],
    ["/ai/problems", "FE問題"],
    ["/flashcards", "単語帳"],
    ["/ocr", "画像解説"],
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="text-xl font-bold text-ink">
            Manaboard
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
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
