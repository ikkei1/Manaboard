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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-focus">学習記録</p>
          <h1 className="mt-1 text-3xl font-bold">学習タイマー</h1>
        </div>
        <div className="status-pill">{timerSubject}</div>
      </div>

      {toast && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{toast}</p>}

      <section className={`panel mb-6 grid gap-5 ${isRunning ? "border-blue-300 bg-blue-50" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="status-pill">{timerSubject}</span>
            <span className="status-pill">{recordedMinutes}分</span>
          </div>
          <button className="btn-secondary" disabled={isRunning || elapsedSeconds === 0} onClick={resetTimer}>
            リセット
          </button>
        </div>

        <div className="mx-auto w-full max-w-5xl">
          <div className="rounded-md border border-slate-200 bg-white px-4 py-10 text-center font-mono text-6xl font-bold leading-none text-ink sm:text-8xl lg:text-9xl">
            {formatTimer(elapsedSeconds)}
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-3xl gap-3">
          {!isRunning ? (
            <button className="action-primary" onClick={startTimer}>
              開始
            </button>
          ) : (
            <button className="action-danger" onClick={stopAndSave}>
              停止して記録
            </button>
          )}
        </div>
      </section>

      <section className="panel mb-6 grid gap-5">
        <div>
          <h2 className="section-title">分野</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {subjects.map((subject) => (
              <button
                className={`segment-button ${timerSubject === subject ? "segment-on" : "segment-off"}`}
                disabled={isRunning}
                key={subject}
                onClick={() => setTimerSubject(subject)}
                type="button"
              >
                {subject}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="label">メモ</span>
          <input
            className="field mt-1"
            disabled={isRunning}
            placeholder="SQL / 暗号化 / 稼働率"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </label>
      </section>

      <section className="panel mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
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
