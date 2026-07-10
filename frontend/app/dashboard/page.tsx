"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects } from "@/lib/api";

type Dashboard = {
  today_minutes: number;
  week_minutes: number;
  month_minutes: number;
  subject_shares: { subject: string; minutes: number; percent: number }[];
  recent_logs: { id: string; subject: string; study_minutes: number; studied_at: string }[];
};

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

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [planForm, setPlanForm] = useState({
    goal_name: "基本情報技術者試験 合格",
    exam_date: "",
    weekday_minutes: 60,
    weekend_minutes: 120,
    subjects: ["テクノロジ系", "アルゴリズム", "セキュリティ"],
    use_weak_analysis: false,
  });

  async function load() {
    const [dashboardData, scheduleData] = await Promise.all([apiFetch<Dashboard>("/dashboard"), apiFetch<ScheduleItem[]>("/schedules")]);
    setDashboard(dashboardData);
    setSchedules(scheduleData);
  }

  useEffect(() => {
    load().catch((error) => setError(error.message));
  }, []);

  const coverage = useMemo(() => {
    if (!dashboard) return 0;
    const studied = new Set(dashboard.subject_shares.map((item) => item.subject));
    return Math.round((studied.size / subjects.length) * 100);
  }, [dashboard]);

  const nextArea = useMemo(() => {
    if (!dashboard) return subjects[0];
    const studied = new Set(dashboard.subject_shares.map((item) => item.subject));
    return subjects.find((subject) => !studied.has(subject)) ?? subjects[0];
  }, [dashboard]);

  const todayPlans = schedules.filter((item) => !item.is_completed).slice(0, 5);

  function toggleSubject(subject: string) {
    setPlanForm((current) => ({
      ...current,
      subjects: current.subjects.includes(subject)
        ? current.subjects.filter((item) => item !== subject)
        : [...current.subjects, subject],
    }));
  }

  async function generateSchedule(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await apiFetch("/schedules/generate", { method: "POST", body: JSON.stringify(planForm) });
      setMessage("計画を作成しました");
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSchedule(id: string) {
    await apiFetch(`/schedules/${id}/complete`, { method: "PATCH" });
    await load();
  }

  async function removeSchedule(id: string) {
    await apiFetch(`/schedules/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <Shell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-focus">基本情報技術者試験</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">ホーム</h1>
        </div>
        <div className="status-pill">カバー {coverage}%</div>
      </div>

      {error && <p className="panel text-red-700">{error}</p>}
      {!dashboard ? (
        <p className="panel">読み込み中...</p>
      ) : (
        <div className="grid gap-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <Link className="action-primary" href="/study">
              学習タイマー
            </Link>
            <Link className="action-primary bg-ink hover:bg-slate-800" href="/ai/problems">
              FE問題
            </Link>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <Stat title="今日" value={dashboard.today_minutes} suffix="分" />
            <Stat title="今週" value={dashboard.week_minutes} suffix="分" />
            <Stat title="今月" value={dashboard.month_minutes} suffix="分" />
            <Stat title="カバー" value={coverage} suffix="%" />
          </section>

          <section className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
            <div className="panel">
              <h2 className="section-title">分野別の学習配分</h2>
              <div className="grid gap-3">
                {subjects.map((subject) => {
                  const item = dashboard.subject_shares.find((share) => share.subject === subject);
                  const percent = item?.percent ?? 0;
                  return (
                    <div key={subject}>
                      <div className="mb-1 flex justify-between text-sm font-semibold">
                        <span>{subject}</span>
                        <span>{item?.minutes ?? 0}分</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100">
                        <div className="h-3 rounded-full bg-focus" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <h2 className="section-title">次の優先分野</h2>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
                <p className="mt-1 text-2xl font-bold text-blue-950">{nextArea}</p>
              </div>
              <div className="mt-4 grid gap-3">
                {todayPlans.length === 0 && <p className="text-slate-500">なし</p>}
                {todayPlans.map((item) => (
                  <button className="flex gap-3 rounded-md border border-slate-200 p-3 text-left hover:border-focus" key={item.id} onClick={() => toggleSchedule(item.id)}>
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white"></span>
                    <span className="min-w-0">
                      <b>{item.scheduled_date}</b> {item.subject} / {item.study_minutes}分
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <form className="panel grid gap-4" onSubmit={generateSchedule}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title">計画作成</h2>
                <span className="status-pill">14日</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">
                  試験日
                  <input className="field" required type="date" value={planForm.exam_date} onChange={(event) => setPlanForm({ ...planForm, exam_date: event.target.value })} />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  目標名
                  <input className="field" value={planForm.goal_name} onChange={(event) => setPlanForm({ ...planForm, goal_name: event.target.value })} />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  平日
                  <input className="field" min="10" type="number" value={planForm.weekday_minutes} onChange={(event) => setPlanForm({ ...planForm, weekday_minutes: Number(event.target.value) })} />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  休日
                  <input className="field" min="10" type="number" value={planForm.weekend_minutes} onChange={(event) => setPlanForm({ ...planForm, weekend_minutes: Number(event.target.value) })} />
                </label>
              </div>
              <div>
                <p className="label">対象分野</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {subjects.map((subject) => (
                    <button
                      className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
                        planForm.subjects.includes(subject) ? "border-focus bg-focus text-white" : "border-slate-200 bg-white text-slate-700"
                      }`}
                      key={subject}
                      onClick={() => toggleSubject(subject)}
                      type="button"
                    >
                      {subject}
                    </button>
                  ))}
                </div>
              </div>
              <button className="action-primary" disabled={busy || !planForm.subjects.length}>
                {busy ? "作成中..." : "計画を作成"}
              </button>
              {message && <p className="notice">{message}</p>}
            </form>

            <div className="panel">
              <h2 className="section-title">学習計画</h2>
              <div className="grid gap-3">
                {schedules.length === 0 && <p className="text-slate-500">なし</p>}
                {schedules.slice(0, 8).map((item) => (
                  <article className={`rounded-md border border-slate-200 p-3 ${item.is_completed ? "opacity-55" : ""}`} key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button className="flex flex-1 gap-3 text-left" onClick={() => toggleSchedule(item.id)}>
                        <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${item.is_completed ? "border-focus bg-focus" : "border-slate-300"}`}></span>
                        <span>
                        <p className="text-sm font-semibold text-slate-500">{item.scheduled_date} ・ {item.priority}</p>
                        <h3 className="font-bold">
                          {item.subject}：{item.unit} <span className="text-focus">{item.study_minutes}分</span>
                        </h3>
                        </span>
                      </button>
                      <button className="font-semibold text-coral" onClick={() => removeSchedule(item.id)}>
                        削除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="section-title">直近の学習</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {!dashboard.recent_logs.length && <p className="text-slate-500">なし</p>}
              {dashboard.recent_logs.map((log) => (
                <div className="rounded-md border border-slate-200 p-3" key={log.id}>
                  <div className="flex justify-between font-semibold">
                    <span>{log.subject}</span>
                    <span>{log.study_minutes}分</span>
                  </div>
                  <p className="text-sm text-slate-600">{log.studied_at}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

function Stat({ title, value, suffix }: { title: string; value: number; suffix: string }) {
  return (
    <div className="panel">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">
        {value}
        <span className="ml-1 text-base text-slate-500">{suffix}</span>
      </p>
    </div>
  );
}
