"use client";

import { FormEvent, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects } from "@/lib/api";

type ScheduleItem = {
  id: string;
  scheduled_date: string;
  subject: string;
  unit: string;
  study_minutes: number;
  task_detail: string;
  priority: string;
  is_completed: boolean;
};

export default function Page() {
  const [list, setList] = useState<ScheduleItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    goal_name: "基本情報技術者試験 合格",
    exam_date: "",
    weekday_minutes: 60,
    weekend_minutes: 120,
    subjects: ["テクノロジ系"],
    use_weak_analysis: true,
  });

  async function load() {
    try {
      setList(await apiFetch<ScheduleItem[]>("/schedules"));
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await apiFetch("/schedules/generate", { method: "POST", body: JSON.stringify(form) });
      setMessage("基本情報向けの学習予定を作成しました");
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string) {
    await apiFetch(`/schedules/${id}/complete`, { method: "PATCH" });
    await load();
  }

  async function remove(id: string) {
    await apiFetch(`/schedules/${id}`, { method: "DELETE" });
    await load();
  }

  function toggleSubject(subject: string) {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.includes(subject)
        ? current.subjects.filter((item) => item !== subject)
        : [...current.subjects, subject],
    }));
  }

  return (
    <Shell>
      <div className="mb-6">
        <p className="text-sm font-semibold text-focus">基本情報技術者試験</p>
        <h1 className="mt-1 text-3xl font-bold">学習スケジュール</h1>
        <p className="mt-2 text-slate-600">試験日までの学習を、分野ごとに日割りで整理します。</p>
      </div>

      <form className="panel grid gap-4 md:grid-cols-2" onSubmit={generate}>
        <label>
          目標名
          <input
            required
            className="field mt-1"
            value={form.goal_name}
            onChange={(event) => setForm({ ...form, goal_name: event.target.value })}
          />
        </label>
        <label>
          試験日
          <input
            required
            type="date"
            className="field mt-1"
            value={form.exam_date}
            onChange={(event) => setForm({ ...form, exam_date: event.target.value })}
          />
        </label>
        <label>
          平日の学習時間（分）
          <input
            type="number"
            min="10"
            className="field mt-1"
            value={form.weekday_minutes}
            onChange={(event) => setForm({ ...form, weekday_minutes: Number(event.target.value) })}
          />
        </label>
        <label>
          休日の学習時間（分）
          <input
            type="number"
            min="10"
            className="field mt-1"
            value={form.weekend_minutes}
            onChange={(event) => setForm({ ...form, weekend_minutes: Number(event.target.value) })}
          />
        </label>
        <fieldset className="md:col-span-2">
          <legend className="mb-2 font-semibold">対象分野</legend>
          <div className="flex flex-wrap gap-3">
            {subjects.map((subject) => (
              <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold" key={subject}>
                <input type="checkbox" checked={form.subjects.includes(subject)} onChange={() => toggleSubject(subject)} />
                {subject}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={form.use_weak_analysis}
            onChange={(event) => setForm({ ...form, use_weak_analysis: event.target.checked })}
          />
          苦手分析を予定に反映する
        </label>
        <button className="btn-primary md:col-span-2" disabled={busy || !form.subjects.length}>
          {busy ? "生成中..." : "スケジュールを生成"}
        </button>
      </form>

      {message && <p className="notice">{message}</p>}

      <div className="mt-5 grid gap-3">
        {list.map((item) => (
          <article className={`panel flex flex-col gap-3 sm:flex-row sm:items-center ${item.is_completed ? "opacity-60" : ""}`} key={item.id}>
            <input aria-label="完了" type="checkbox" checked={item.is_completed} onChange={() => toggle(item.id)} className="h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-500">
                {item.scheduled_date} ・ {item.priority}
              </p>
              <h2 className="font-bold">
                {item.subject}：{item.unit} <span className="text-focus">{item.study_minutes}分</span>
              </h2>
              <p>{item.task_detail}</p>
            </div>
            <button className="btn-secondary" onClick={() => remove(item.id)}>
              削除
            </button>
          </article>
        ))}
      </div>
    </Shell>
  );
}
