"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
export default function LoginPage() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); try { await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); router.push("/dashboard"); } catch (e) { setError(e instanceof Error ? e.message : "ログインできませんでした"); } }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><form className="panel grid w-full max-w-md gap-4" onSubmit={submit}><div><h1 className="text-2xl font-bold">StudyPilot</h1><p className="text-sm text-slate-600">学習の記録を始めましょう</p></div>{error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<label className="grid gap-1 text-sm font-semibold">メールアドレス<input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label className="grid gap-1 text-sm font-semibold">パスワード<input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="btn-primary">ログイン</button><Link className="text-center text-sm font-semibold text-focus" href="/register">アカウントを作成</Link></form></main>;
}
