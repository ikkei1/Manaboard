"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects } from "@/lib/api";

type Dashboard = {
  today_minutes: number;
  week_minutes: number;
  month_minutes: number;
  subject_shares: { subject: string; minutes: number; percent: number }[];
  recent_logs: { id: string; subject: string; study_minutes: number; studied_at: string }[];
};

type Analysis = {
  weak_units: { subject: string; unit?: string; accuracy: number; mistake_count?: number }[];
  mistake_trends: { type: string; count: number }[];
  ai_advice: string;
};

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch<Dashboard>("/dashboard"), apiFetch<Analysis>("/analysis")])
      .then(([dashboardData, analysisData]) => {
        setDashboard(dashboardData);
        setAnalysis(analysisData);
      })
      .catch((error) => setError(error.message));
  }, []);

  const coverage = useMemo(() => {
    if (!dashboard) return 0;
    const studied = new Set(dashboard.subject_shares.map((item) => item.subject));
    return Math.round((studied.size / subjects.length) * 100);
  }, [dashboard]);

  const nextArea = useMemo(() => {
    if (!dashboard) return subjects[0];
    const studied = new Set(dashboard.subject_shares.map((item) => item.subject));
    return subjects.find((subject) => !studied.has(subject)) ?? analysis?.weak_units[0]?.subject ?? subjects[0];
  }, [analysis, dashboard]);

  return (
    <Shell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-focus">基本情報技術者試験</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">学習ダッシュボード</h1>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          分野カバー率 {coverage}%
        </div>
      </div>

      {error && <p className="panel text-red-700">{error}</p>}
      {!dashboard ? (
        <p className="panel">読み込み中...</p>
      ) : (
        <div className="grid gap-5">
          <section className="grid gap-4 md:grid-cols-4">
            <Stat title="今日" value={dashboard.today_minutes} suffix="分" />
            <Stat title="今週" value={dashboard.week_minutes} suffix="分" />
            <Stat title="今月" value={dashboard.month_minutes} suffix="分" />
            <Stat title="分野カバー" value={coverage} suffix="%" />
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="panel">
              <h2 className="section-title">FE分野別の学習配分</h2>
              <div className="grid gap-3">
                {subjects.map((subject) => {
                  const item = dashboard.subject_shares.find((share) => share.subject === subject);
                  const percent = item?.percent ?? 0;
                  return (
                    <div key={subject}>
                      <div className="mb-1 flex justify-between text-sm font-semibold">
                        <span>{subject}</span>
                        <span>{item?.minutes ?? 0}分 / {percent}%</span>
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
              <h2 className="section-title">次にやること</h2>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">優先分野</p>
                <p className="mt-1 text-2xl font-bold text-blue-950">{nextArea}</p>
              </div>
              <p className="mt-4 leading-7 text-slate-700">
                {analysis?.weak_units.length
                  ? `${analysis.weak_units[0].subject}の「${analysis.weak_units[0].unit ?? "基礎"}」を復習し、AI問題で確認しましょう。`
                  : "未学習の分野から1つ選び、学習記録とAI問題を追加しましょう。"}
              </p>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="panel">
              <h2 className="section-title">弱点候補</h2>
              <div className="grid gap-3">
                {!analysis?.weak_units.length && <p className="text-slate-500">問題に回答すると弱点が表示されます。</p>}
                {analysis?.weak_units.slice(0, 5).map((item, index) => (
                  <div className="flex items-center justify-between rounded-md border border-slate-200 p-3" key={`${item.subject}-${item.unit}-${index}`}>
                    <span>
                      <b>{item.subject}</b>
                      {item.unit && <span className="text-slate-600"> / {item.unit}</span>}
                    </span>
                    <b className="text-rose-600">{item.accuracy}%</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2 className="section-title">直近の学習</h2>
              <div className="grid gap-3">
                {!dashboard.recent_logs.length && <p className="text-slate-500">まだ学習記録がありません。</p>}
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
