import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manaboard",
  description: "学習記録と目標管理アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
