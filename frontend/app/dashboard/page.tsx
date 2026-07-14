"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Shell } from "@/components/Shell";
import { apiFetch } from "@/lib/api";

type Dashboard = {
  today_minutes: number;
  week_minutes: number;
  month_minutes: number;
  recent_logs: { id: string; study_minutes: number; studied_at: string; memo?: string }[];
};

type Problem = {
  id?: string;
  question: string;
  unit: string;
  created_at?: string;
};

type FlashcardResponse = {
  items: { id: string; term: string; status: "new" | "learning" }[];
  stats: { total: number; new: number; learning: number; pending: number; learned: number; today_reviewed: number };
};

const emptyDashboard: Dashboard = {
  today_minutes: 0,
  week_minutes: 0,
  month_minutes: 0,
  recent_logs: [],
};

const emptyFlashcards: FlashcardResponse = {
  items: [],
  stats: { total: 0, new: 0, learning: 0, pending: 0, learned: 0, today_reviewed: 0 },
};

function cleanText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&lt;\/?u&gt;/gi, "")
    .replace(/<\/?u>/gi, "")
    .replace(/&lt;[^&]+&gt;/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardResponse>(emptyFlashcards);
  const [error, setError] = useState("");
  const dashboardView = dashboard ?? emptyDashboard;

  async function load() {
    const [dashboardData, problemData, flashcardData] = await Promise.all([
      apiFetch<Dashboard>("/dashboard"),
      apiFetch<Problem[]>("/ai/problems"),
      apiFetch<FlashcardResponse>("/flashcards"),
    ]);
    setDashboard(dashboardData);
    setProblems(problemData);
    setFlashcards(flashcardData);
  }

  useEffect(() => {
    load().catch((error) => setError(error.message));
  }, []);

  const studyGoalPercent = useMemo(() => Math.min(100, Math.round((dashboardView.week_minutes / 600) * 100)), [dashboardView.week_minutes]);
  const todayFlashcardTotal = flashcards.stats.today_reviewed + flashcards.items.length;
  const recentProblems = problems.slice(0, 3);
  const recentLogs = dashboardView.recent_logs.slice(0, 4);

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-ink">ホーム</h1>
      </div>

      {error && <p className="panel text-red-700">{error}</p>}
      {!dashboard && !error && <p className="notice mb-5">読み込み中...</p>}

      <div className="grid gap-5">
        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="panel">
            <div className="mb-5">
              <Link className="section-title mb-0 inline-flex items-center gap-2 transition hover:text-focus" href="/study">
                <Icon name="clock" size={20} />
                学習記録
                <Icon name="chevronRight" size={18} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-[210px_1fr] sm:items-center">
              <ProgressRing label="週間" value={studyGoalPercent} />
              <div className="grid gap-3">
                <MetricLine title="今日" value={`${dashboardView.today_minutes}分`} percent={Math.min(100, Math.round((dashboardView.today_minutes / 120) * 100))} />
                <MetricLine title="今週" value={`${dashboardView.week_minutes}分`} percent={studyGoalPercent} />
                <MetricLine title="今月" value={`${dashboardView.month_minutes}分`} percent={Math.min(100, Math.round((dashboardView.month_minutes / 2400) * 100))} />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="mb-5">
              <Link className="section-title mb-0 inline-flex items-center gap-2 transition hover:text-focus" href="/flashcards">
                <Icon name="cards" size={20} />
                単語帳
                <Icon name="chevronRight" size={18} />
              </Link>
            </div>
            <div className="grid gap-3">
              <MetricLine title="今日学習" value={`${flashcards.stats.today_reviewed}語`} percent={ratio(flashcards.stats.today_reviewed, todayFlashcardTotal)} />
              <MetricLine title="未学習・復習" value={`${flashcards.stats.pending}語`} percent={ratio(flashcards.stats.pending, flashcards.stats.total)} />
              <MetricLine title="学習済み" value={`${flashcards.stats.learned}語`} percent={ratio(flashcards.stats.learned, flashcards.stats.total)} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="panel">
            <div className="mb-4">
              <Link className="section-title mb-0 inline-flex items-center gap-2 transition hover:text-focus" href="/ai/problems">
                <Icon name="problems" size={20} />
                AI問題
                <Icon name="chevronRight" size={18} />
              </Link>
            </div>
            <div className="grid gap-3">
              {recentProblems.length === 0 && <EmptyLine icon="problems" text="まだありません" />}
              {recentProblems.map((problem) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={problem.id ?? problem.question}>
                  <p className="text-sm font-bold text-slate-500">{cleanText(problem.unit)}</p>
                  <p className="mt-1 line-clamp-2 font-semibold text-ink">{cleanText(problem.question)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2 className="section-title inline-flex items-center gap-2">
              <Icon name="list" size={20} />
              最近の学習
            </h2>
            <div className="grid gap-3">
              {recentLogs.length === 0 && <EmptyLine icon="clock" text="まだありません" />}
              {recentLogs.map((log) => (
                <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3" key={log.id}>
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{log.study_minutes}分</p>
                    <p className="truncate text-sm text-slate-500">{log.memo || log.studied_at}</p>
                  </div>
                  <span className="status-pill shrink-0">{log.studied_at}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function ProgressRing({ label, value }: { label: string; value: number }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="mx-auto grid h-52 w-52 place-items-center rounded-full" style={{ background: `conic-gradient(#2563eb ${bounded * 3.6}deg, #e2e8f0 0deg)` }}>
      <div className="grid h-36 w-36 place-items-center rounded-full bg-white text-center shadow-inner">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="text-4xl font-bold text-ink">{bounded}%</p>
        </div>
      </div>
    </div>
  );
}

function MetricLine({ title, value, percent }: { title: string; value: string; percent: number }) {
  const bounded = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm font-bold">
        <span className="text-slate-600">{title}</span>
        <span className="text-ink">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-3 rounded-full bg-focus" style={{ width: `${bounded}%` }} />
      </div>
    </div>
  );
}

function EmptyLine({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="grid min-h-28 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
      <div className="text-center">
        <Icon className="mx-auto" name={icon} size={34} />
        <p className="mt-2 font-bold">{text}</p>
      </div>
    </div>
  );
}
