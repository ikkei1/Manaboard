"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects, todayString } from "@/lib/api";

type StudyLog = { id: string; subject: string; study_minutes: number; studied_at: string; memo?: string };
type StudyList = { items: StudyLog[]; total: number; page: number; page_size: number };

function formatTimer(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function StudyPage() {
  const [data, setData] = useState<StudyList | null>(null);
  const [page, setPage] = useState(1);
  const [filterSubject, setFilterSubject] = useState("");
  const [studiedAt, setStudiedAt] = useState("");
  const [toast, setToast] = useState("");
  const [timerSubject, setTimerSubject] = useState(subjects[0]);
  const [memo, setMemo] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isRunning = startedAt !== null;
  const recordedMinutes = useMemo(() => Math.max(1, Math.ceil(elapsedSeconds / 60)), [elapsedSeconds]);

  async function load() {
    const params = new URLSearchParams({ page: String(page) });
    if (filterSubject) params.set("subject", filterSubject);
    if (studiedAt) params.set("studied_at", studiedAt);
    setData(await apiFetch<StudyList>(`/study?${params}`));
  }

  useEffect(() => {
    load().catch((error) => setToast(error.message));
  }, [page, filterSubject, studiedAt]);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  function startTimer() {
    setToast("");
    setElapsedSeconds(0);
    setStartedAt(Date.now());
  }

  async function stopAndSave() {
    if (!startedAt) return;
    const seconds = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    setStartedAt(null);
    setElapsedSeconds(seconds);
    await apiFetch("/study", {
      method: "POST",
      body: JSON.stringify({
        subject: timerSubject,
        study_minutes: minutes,
        studied_at: todayString(),
        memo: memo || `タイマーで${formatTimer(seconds)}学習`,
      }),
    });
    setMemo("");
    setToast(`${timerSubject}を${minutes}分として自動記録しました`);
    await load();
  }

  function resetTimer() {
    setStartedAt(null);
    setElapsedSeconds(0);
  }

  async function remove(id: string) {
    if (!confirm("本当に削除しますか？")) return;
    await apiFetch(`/study/${id}`, { method: "DELETE" });
    setToast("削除しました");
    await load();
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <Shell>
      <div className="mb-6">
        <p className="text-sm font-semibold text-focus">学習記録</p>
        <h1 className="mt-1 text-3xl font-bold">分野を選んでタイマー開始</h1>
      </div>

      {toast && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{toast}</p>}

      <section className="panel mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">
            分野
            <select className="field" disabled={isRunning} value={timerSubject} onChange={(event) => setTimerSubject(event.target.value)}>
              {subjects.map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold md:col-span-2">
            メモ
            <input
              className="field"
              disabled={isRunning}
              placeholder="例: SQLの結合を復習"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-[auto_auto_auto] sm:items-center">
          <div className="rounded-md border border-slate-200 bg-white px-5 py-3 text-center font-mono text-3xl font-bold text-ink">
            {formatTimer(elapsedSeconds)}
          </div>
          {!isRunning ? (
            <button className="btn-primary" onClick={startTimer}>
              開始
            </button>
          ) : (
            <button className="btn-primary" onClick={stopAndSave}>
              停止して記録
            </button>
          )}
          <button className="btn-secondary" disabled={isRunning || elapsedSeconds === 0} onClick={resetTimer}>
            リセット
          </button>
        </div>
      </section>

      <section className="panel mb-5 grid gap-3 md:grid-cols-3">
        <select
          className="field"
          value={filterSubject}
          onChange={(event) => {
            setPage(1);
            setFilterSubject(event.target.value);
          }}
        >
          <option value="">すべての分野</option>
          {subjects.map((subject) => (
            <option key={subject}>{subject}</option>
          ))}
        </select>
        <input
          className="field"
          type="date"
          value={studiedAt}
          onChange={(event) => {
            setPage(1);
            setStudiedAt(event.target.value);
          }}
        />
        <button
          className="btn-secondary"
          onClick={() => {
            setFilterSubject("");
            setStudiedAt("");
          }}
        >
          検索をクリア
        </button>
      </section>

      <section className="panel overflow-x-auto">
        {!data ? (
          <p>読み込み中...</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2">分野</th>
                <th>学習時間</th>
                <th>学習日</th>
                <th>メモ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr className="border-b last:border-0" key={log.id}>
                  <td className="py-3 font-semibold">{log.subject}</td>
                  <td>{log.study_minutes}分</td>
                  <td>{log.studied_at}</td>
                  <td className="max-w-xs truncate">{log.memo}</td>
                  <td className="space-x-2 text-right">
                    <Link className="font-semibold text-focus" href={`/study/edit/${log.id}`}>
                      編集
                    </Link>
                    <button className="font-semibold text-coral" onClick={() => remove(log.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.items.length === 0 && <p className="py-4 text-slate-500">記録がありません</p>}
      </section>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          前へ
        </button>
        <span className="text-sm font-semibold">
          {page} / {pages}
        </span>
        <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          次へ
        </button>
      </div>
    </Shell>
  );
}
