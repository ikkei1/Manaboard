"use client";
import { FormEvent, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects } from "@/lib/api";
type Goal = { id: string; subject: string; target_minutes: number; current_minutes: number; achievement_rate: number };
export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]); const [form, setForm] = useState({ subject: "数学", target_minutes: 6000 }); const [message, setMessage] = useState("");
  async function load() { setGoals(await apiFetch<Goal[]>("/goals")); }
  useEffect(() => { load().catch((e) => setMessage(e.message)); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); setMessage(""); try { await apiFetch("/goals", { method: "POST", body: JSON.stringify(form) }); setMessage("目標を保存しました"); load(); } catch (e) { setMessage(e instanceof Error ? e.message : "保存できませんでした"); } }
  async function remove(id: string) { if (!confirm("本当に削除しますか？")) return; await apiFetch(`/goals/${id}`, { method: "DELETE" }); setMessage("削除しました"); load(); }
  return <Shell><div className="mb-6"><h1 className="text-3xl font-bold">目標設定</h1><p className="text-slate-600">教科ごとの目標時間と達成率を管理します</p></div>{message && <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}<form className="panel mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={submit}><select className="field" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>{subjects.map((s) => <option key={s}>{s}</option>)}</select><input className="field" type="number" min={1} value={form.target_minutes} onChange={(e) => setForm({ ...form, target_minutes: Number(e.target.value) })} /><button className="btn-primary">登録</button></form><section className="grid gap-4 md:grid-cols-2">{goals.map((goal) => <article className="panel" key={goal.id}><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{goal.subject}</h2><p className="text-sm text-slate-600">目標 {goal.target_minutes}分 / 現在 {goal.current_minutes}分</p></div><button className="font-semibold text-coral" onClick={() => remove(goal.id)}>削除</button></div><div className="mt-4 h-4 rounded-full bg-slate-100"><div className="h-4 rounded-full bg-focus" style={{ width: `${goal.achievement_rate}%` }} /></div><p className="mt-2 text-right text-sm font-bold">達成率 {goal.achievement_rate}%</p></article>)}{goals.length === 0 && <p className="panel text-slate-500">目標がありません</p>}</section></Shell>;
}
