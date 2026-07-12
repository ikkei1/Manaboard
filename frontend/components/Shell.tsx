"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const links: { href: string; label: string; icon: IconName }[] = [
    { href: "/dashboard", label: "ホーム", icon: "home" },
    { href: "/study", label: "学習記録", icon: "timer" },
    { href: "/ai/problems", label: "AI問題", icon: "problems" },
    { href: "/flashcards", label: "単語帳", icon: "cards" },
    { href: "/ocr", label: "画像解説", icon: "image" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-6xl gap-2 px-4 py-3 md:flex md:items-center md:justify-between md:gap-3">
          <Link
            href="/dashboard"
            className="flex h-9 w-40 shrink-0 items-center overflow-hidden rounded-md bg-white md:h-10 md:w-44"
            aria-label="Manaboard ホーム"
          >
            <img alt="Manaboard" className="h-full w-full object-cover" src="/brand/manaboard-logo.png" />
          </Link>
          <nav className="grid w-full grid-cols-5 gap-1 text-[11px] font-semibold md:flex md:w-auto md:min-w-0 md:flex-1 md:flex-wrap md:justify-end md:text-sm">
            {links.map(({ href, label, icon }) => (
              <Link
                key={href}
                className={`inline-flex min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-md px-1 py-2 text-center transition md:flex-row md:gap-2 md:px-3 ${
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
