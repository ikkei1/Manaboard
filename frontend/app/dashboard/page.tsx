"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
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

const subjectColors = ["#2563eb", "#0f9f7a", "#ef6f61", "#7c3aed", "#0891b2", "#d97706", "#64748b"];
const subjectIcons: IconName[] = ["book", "problems", "chart", "target", "settings", "calendar", "home"];
const emptyDashboard: Dashboard = {
  today_minutes: 0,
  week_minutes: 0,
  month_minutes: 0,
  subject_shares: [],
  recent_logs: [],
};

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultPassPlan() {
  return {
    goal_name: "基本情報技術者試験 合格",
    exam_date: dateAfter(90),
    weekday_minutes: 90,
    weekend_minutes: 180,
    subjects: [...subjects],
    use_weak_analysis: false,
  };
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [planForm, setPlanForm] = useState(defaultPassPlan);
  const dashboardView = dashboard ?? emptyDashboard;

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

  const subjectRows = useMemo(() => {
    const source = dashboard ?? emptyDashboard;
    const minutesBySubject = new Map(source.subject_shares.map((item) => [item.subject, item.minutes]));
    const maxMinutes = Math.max(...subjects.map((subject) => minutesBySubject.get(subject) ?? 0), 1);
    return subjects.map((subject, index) => {
      const minutes = minutesBySubject.get(subject) ?? 0;
      return {
        color: subjectColors[index % subjectColors.length],
        icon: subjectIcons[index % subjectIcons.length],
        minutes,
        percent: Math.round((minutes / maxMinutes) * 100),
        subject,
      };
    });
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
      <div className="mb-5">
        <div>
          <h1 className="text-3xl font-bold text-ink">ホーム</h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 font-bold text-blue-950">
            <Icon name="target" size={19} />
            カバー {coverage}%
          </div>
        </div>
      </div>

      {error && <p className="panel text-red-700">{error}</p>}
      {!dashboard && !error && <p className="notice mb-5">読み込み中...</p>}
      <div className="grid gap-5">
          <section className="grid gap-4 md:grid-cols-4">
            <Metric icon="clock" title="今日" value={dashboardView.today_minutes} suffix="分" tone="blue" />
            <Metric icon="calendar" title="今週" value={dashboardView.week_minutes} suffix="分" tone="mint" />
            <Metric icon="chart" title="今月" value={dashboardView.month_minutes} suffix="分" tone="coral" />
            <Metric icon="target" title="カバー" value={coverage} suffix="%" tone="slate" />
          </section>

          <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="panel">
              <h2 className="section-title inline-flex items-center gap-2">
                <Icon name="target" size={20} />
                合格準備
              </h2>
              <div className="grid gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
                <DonutChart value={coverage} />
                <div className="grid gap-3">
                  <VisualNote icon="book" title="次の優先分野" value={nextArea} />
                  <VisualNote icon="calendar" title="今週" value={`${dashboardView.week_minutes}分`} />
                  <VisualNote icon="clock" title="今日" value={`${dashboardView.today_minutes}分`} />
                </div>
              </div>
            </div>

            <div className="panel">
              <h2 className="section-title inline-flex items-center gap-2">
                <Icon name="chart" size={20} />
                分野別
              </h2>
              <div className="grid gap-3">
                {subjectRows.map((row) => (
                  <div key={row.subject}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm font-semibold">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: row.color }}>
                          <Icon name={row.icon} size={17} />
                        </span>
                        <span className="truncate">{row.subject}</span>
                      </span>
                      <span className="shrink-0">{row.minutes}分</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-3 rounded-full" style={{ backgroundColor: row.color, width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title mb-0 inline-flex items-center gap-2">
                <Icon name="check" size={20} />
                今日のタスク
              </h2>
            </div>
            <div className="grid gap-3">
              {todayPlans.length === 0 && (
                <div className="grid min-h-28 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                  <div className="text-center">
                    <Icon className="mx-auto" name="check" size={34} />
                    <p className="mt-2 font-bold">なし</p>
                  </div>
                </div>
              )}
              {todayPlans.map((item) => (
                <button className="flex items-center gap-3 rounded-md border border-slate-200 p-3 text-left transition hover:border-focus hover:bg-blue-50" key={item.id} onClick={() => toggleSchedule(item.id)} type="button">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500">
                    <Icon name="check" size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-500">{item.scheduled_date}</span>
                    <span className="block truncate font-bold text-ink">
                      {item.subject} / {item.unit}
                    </span>
                  </span>
                  <span className="status-pill shrink-0">{item.study_minutes}分</span>
                </button>
              ))}
            </div>
          </section>

          <details className="panel">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <span className="section-title mb-0 inline-flex items-center gap-2">
                <Icon name="settings" size={20} />
                計画設定
              </span>
              <span className="status-pill">開く</span>
            </summary>
            <form className="mt-4 grid gap-4" onSubmit={generateSchedule}>
              <div className="flex justify-end">
                <button className="btn-secondary gap-2" onClick={() => setPlanForm(defaultPassPlan())} type="button">
                  <Icon name="target" size={18} />
                  合格プラン
                </button>
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
                      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ${
                        planForm.subjects.includes(subject) ? "border-focus bg-focus text-white" : "border-slate-200 bg-white text-slate-700 hover:border-focus hover:bg-blue-50"
                      }`}
                      key={subject}
                      onClick={() => toggleSubject(subject)}
                      type="button"
                    >
                      <Icon name={planForm.subjects.includes(subject) ? "check" : "plus"} size={17} />
                      {subject}
                    </button>
                  ))}
                </div>
              </div>
              <button className="action-primary gap-2" disabled={busy || !planForm.subjects.length}>
                <Icon name="calendar" size={22} />
                {busy ? "作成中..." : "計画を作成"}
              </button>
              {message && <p className="notice">{message}</p>}
            </form>
          </details>

          <details className="panel">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <span className="section-title mb-0 inline-flex items-center gap-2">
                <Icon name="calendar" size={20} />
                学習計画
              </span>
              <span className="status-pill">開く</span>
            </summary>
              <div className="mt-4 grid gap-3">
                {schedules.length === 0 && <p className="text-slate-500">なし</p>}
                {schedules.slice(0, 8).map((item) => (
                  <article className={`rounded-md border border-slate-200 p-3 ${item.is_completed ? "opacity-55" : ""}`} key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button className="flex flex-1 gap-3 text-left" onClick={() => toggleSchedule(item.id)} type="button">
                        <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${item.is_completed ? "border-focus bg-focus text-white" : "border-slate-300"}`}>
                          {item.is_completed && <Icon name="check" size={16} />}
                        </span>
                        <span>
                          <p className="text-sm font-semibold text-slate-500">
                            {item.scheduled_date} ・ {item.priority}
                          </p>
                          <h3 className="font-bold">
                            {item.subject}：{item.unit} <span className="text-focus">{item.study_minutes}分</span>
                          </h3>
                        </span>
                      </button>
                      <button className="btn-secondary gap-2 text-coral" onClick={() => removeSchedule(item.id)} type="button">
                        <Icon name="x" size={17} />
                        削除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
          </details>

          <details className="panel">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <span className="section-title mb-0 inline-flex items-center gap-2">
                <Icon name="list" size={20} />
                直近の学習
              </span>
              <span className="status-pill">開く</span>
            </summary>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {!dashboardView.recent_logs.length && <p className="text-slate-500">なし</p>}
                {dashboardView.recent_logs.map((log) => (
                  <div className="rounded-md border border-slate-200 p-3" key={log.id}>
                    <div className="flex justify-between gap-3 font-semibold">
                      <span>{log.subject}</span>
                      <span>{log.study_minutes}分</span>
                    </div>
                    <p className="text-sm text-slate-600">{log.studied_at}</p>
                  </div>
                ))}
              </div>
          </details>
        </div>
    </Shell>
  );
}

function Metric({ icon, title, value, suffix, tone }: { icon: IconName; title: string; value: number; suffix: string; tone: "blue" | "mint" | "coral" | "slate" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    coral: "bg-red-50 text-coral",
    mint: "bg-emerald-50 text-mint",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <div className="panel">
      <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md ${toneClass}`}>
        <Icon name={icon} size={22} />
      </div>
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-bold">
        {value}
        <span className="ml-1 text-base text-slate-500">{suffix}</span>
      </p>
    </div>
  );
}

function DonutChart({ value }: { value: number }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="mx-auto grid h-52 w-52 place-items-center rounded-full" style={{ background: `conic-gradient(#2563eb ${bounded * 3.6}deg, #e2e8f0 0deg)` }}>
      <div className="grid h-36 w-36 place-items-center rounded-full bg-white text-center shadow-inner">
        <div>
          <p className="text-sm font-bold text-slate-500">カバー</p>
          <p className="text-4xl font-bold text-ink">{bounded}%</p>
        </div>
      </div>
    </div>
  );
}

function VisualNote({ icon, title, value }: { icon: IconName; title: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-focus">
        <Icon name={icon} size={21} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-500">{title}</span>
        <span className="block truncate text-lg font-bold text-ink">{value}</span>
      </span>
    </div>
  );
}
