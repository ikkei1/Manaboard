"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
export default function RegisterPage() {
  const router = useRouter(); const [form, setForm] = useState({ name: "", email: "", password: "" }); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); if (form.name.length > 30) return setError("ユーザー名は30文字以内で入力してください"); if (form.password.length < 8) return setError("パスワードは8文字以上で入力してください"); try { await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(form) }); router.push("/login"); } catch (e) { setError(e instanceof Error ? e.message : "登録できませんでした"); } }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><form className="panel grid w-full max-w-md gap-4" onSubmit={submit}><div><h1 className="text-2xl font-bold">アカウント作成</h1><p className="text-sm text-slate-600">StudyPilot へようこそ</p></div>{error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<label className="grid gap-1 text-sm font-semibold">ユーザー名<input className="field" maxLength={30} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label className="grid gap-1 text-sm font-semibold">メールアドレス<input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label className="grid gap-1 text-sm font-semibold">パスワード<input className="field" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label><button className="btn-primary">登録</button><Link className="text-center text-sm font-semibold text-focus" href="/login">ログインへ戻る</Link></form></main>;
}
