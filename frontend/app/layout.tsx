import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "StudyPilot", description: "学習記録と目標管理アプリ" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ja"><body>{children}</body></html>; }
