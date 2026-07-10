"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const links: { href: string; label: string; icon: IconName }[] = [
    { href: "/dashboard", label: "ホーム", icon: "home" },
    { href: "/study", label: "学習記録", icon: "timer" },
    { href: "/ai/problems", label: "FE問題", icon: "problems" },
    { href: "/flashcards", label: "単語帳", icon: "cards" },
    { href: "/ocr", label: "画像解説", icon: "image" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="flex h-10 w-44 shrink-0 items-center overflow-hidden rounded-md bg-white"
            aria-label="Manaboard ホーム"
          >
            <img alt="Manaboard" className="h-full w-full object-cover" src="/brand/manaboard-logo.png" />
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold">
            {links.map(({ href, label, icon }) => (
              <Link
                key={href}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 transition ${
                  pathname === href ? "bg-focus text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
                href={href}
              >
                <Icon name={icon} size={18} />
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
