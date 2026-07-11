"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects, todayString } from "@/lib/api";

type StudyLog = { id: string; subject: string; study_minutes: number; studied_at: string; memo?: string };
type StudyList = { items: StudyLog[]; total: number; page: number; page_size: number };
type TimerMode = "focus" | "short" | "long";

const DEFAULT_STUDY_SUBJECT = subjects[0];

const timerModes: Record<TimerMode, { label: string; minutes: number; color: string }> = {
  focus: { label: "集中", minutes: 25, color: "#2563eb" },
  short: { label: "小休憩", minutes: 5, color: "#059669" },
  long: { label: "長休憩", minutes: 15, color: "#7c3aed" },
};

function secondsFor(mode: TimerMode) {
  return timerModes[mode].minutes * 60;
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function StudyPage() {
  const [data, setData] = useState<StudyList | null>(null);
  const [page, setPage] = useState(1);
  const [studiedAt, setStudiedAt] = useState("");
  const [toast, setToast] = useState("");
  const [memo, setMemo] = useState("");
  const [timerMode, setTimerMode] = useState<TimerMode>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(secondsFor("focus"));
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocusCount, setCompletedFocusCount] = useState(0);

  const durationSeconds = secondsFor(timerMode);
  const elapsedSeconds = durationSeconds - remainingSeconds;
  const focusElapsedSeconds = timerMode === "focus" ? elapsedSeconds : 0;
  const recordedMinutes = useMemo(() => Math.max(1, Math.ceil(Math.max(1, focusElapsedSeconds) / 60)), [focusElapsedSeconds]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const cycleProgress = completedFocusCount % 4;

  async function load() {
    const params = new URLSearchParams({ page: String(page) });
    if (studiedAt) params.set("studied_at", studiedAt);
    setData(await apiFetch<StudyList>(`/study?${params}`));
  }

  useEffect(() => {
    load().catch((error) => setToast(error.message));
  }, [page, studiedAt]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || remainingSeconds !== 0) return;
    setIsRunning(false);
    void completeSession();
  }, [isRunning, remainingSeconds]);

  function changeMode(nextMode: TimerMode) {
    if (isRunning) return;
    setTimerMode(nextMode);
    setRemainingSeconds(secondsFor(nextMode));
  }

  function startTimer() {
    setToast("");
    if (remainingSeconds === 0) setRemainingSeconds(durationSeconds);
    setIsRunning(true);
  }

  function pauseTimer() {
    setIsRunning(false);
  }

  async function saveFocusSession(seconds: number, fallbackMemo: string) {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    await apiFetch("/study", {
      method: "POST",
      body: JSON.stringify({
        subject: DEFAULT_STUDY_SUBJECT,
        study_minutes: minutes,
        studied_at: todayString(),
        memo: memo || fallbackMemo,
      }),
    });
    setMemo("");
    await load();
    return minutes;
  }

  async function completeSession() {
    if (timerMode === "focus") {
      const nextCount = completedFocusCount + 1;
      const nextMode: TimerMode = nextCount % 4 === 0 ? "long" : "short";
      const minutes = await saveFocusSession(durationSeconds, "ポモドーロ集中完了");
      setCompletedFocusCount(nextCount);
      setTimerMode(nextMode);
      setRemainingSeconds(secondsFor(nextMode));
      setToast(`${minutes}分を記録しました`);
      return;
    }
    setTimerMode("focus");
    setRemainingSeconds(secondsFor("focus"));
    setToast("休憩が終わりました");
  }

  async function finishEarly() {
    setIsRunning(false);
    if (timerMode !== "focus") {
      setTimerMode("focus");
      setRemainingSeconds(secondsFor("focus"));
      setToast("集中に戻しました");
      return;
    }
    if (focusElapsedSeconds <= 0) {
      setRemainingSeconds(durationSeconds);
      return;
    }
    const minutes = await saveFocusSession(focusElapsedSeconds, `ポモドーロで${formatTimer(focusElapsedSeconds)}集中`);
    const nextCount = completedFocusCount + 1;
    const nextMode: TimerMode = nextCount % 4 === 0 ? "long" : "short";
    setCompletedFocusCount(nextCount);
    setTimerMode(nextMode);
    setRemainingSeconds(secondsFor(nextMode));
    setToast(`${minutes}分を記録しました`);
  }

  function resetTimer() {
    setIsRunning(false);
    setRemainingSeconds(durationSeconds);
  }

  async function remove(id: string) {
    if (!confirm("本当に削除しますか？")) return;
    await apiFetch(`/study/${id}`, { method: "DELETE" });
    setToast("削除しました");
    await load();
  }

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">学習タイマー</h1>
        </div>
        <div className="status-pill">自動記録</div>
      </div>

      {toast && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{toast}</p>}

      <section className={`panel mb-6 grid gap-5 ${isRunning ? "border-blue-300 bg-blue-50" : ""}`}>
        <div className="grid gap-3 md:grid-cols-3">
          <TimerTile title="状態" value={timerModes[timerMode].label} />
          <TimerTile title="セット" value={`${cycleProgress}/4`} />
          <TimerTile title="記録予定" value={timerMode === "focus" ? `${recordedMinutes}分` : "休憩中"} />
        </div>

        <PomodoroClock
          color={timerModes[timerMode].color}
          durationSeconds={durationSeconds}
          label={timerModes[timerMode].label}
          remainingSeconds={remainingSeconds}
        />

        <div className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {!isRunning ? (
            <button className="action-primary sm:col-span-2" onClick={startTimer}>
              開始
            </button>
          ) : (
            <button className="action-primary sm:col-span-2" onClick={pauseTimer}>
              一時停止
            </button>
          )}
          <button className="btn-secondary" disabled={isRunning} onClick={resetTimer}>
            リセット
          </button>
          <button className="action-danger sm:col-span-3" disabled={timerMode === "focus" && focusElapsedSeconds <= 0 && !isRunning} onClick={finishEarly}>
            {timerMode === "focus" ? "終了して記録" : "休憩を終了"}
          </button>
        </div>
      </section>

      <section className="panel mb-6 grid gap-5">
        <div>
          <h2 className="section-title">モード</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(timerModes) as TimerMode[]).map((mode) => (
              <button
                className={`segment-button ${timerMode === mode ? "segment-on" : "segment-off"}`}
                disabled={isRunning}
                key={mode}
                onClick={() => changeMode(mode)}
                type="button"
              >
                {timerModes[mode].label} {timerModes[mode].minutes}分
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

      <section className="panel mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          className="field"
          type="date"
          value={studiedAt}
          onChange={(event) => {
            setPage(1);
            setStudiedAt(event.target.value);
          }}
        />
        <button className="btn-secondary" onClick={() => setStudiedAt("")}>
          検索をクリア
        </button>
      </section>

      <section className="panel overflow-x-auto">
        {!data ? (
          <p>読み込み中...</p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2">学習時間</th>
                <th>学習日</th>
                <th>メモ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr className="border-b last:border-0" key={log.id}>
                  <td className="py-3 font-semibold">{log.study_minutes}分</td>
                  <td>{log.studied_at}</td>
                  <td className="max-w-xs truncate">{log.memo}</td>
                  <td className="text-right">
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

function TimerTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 text-center">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function PomodoroClock({
  color,
  durationSeconds,
  label,
  remainingSeconds,
}: {
  color: string;
  durationSeconds: number;
  label: string;
  remainingSeconds: number;
}) {
  const radius = 94;
  const circumference = 2 * Math.PI * radius;
  const progress = durationSeconds ? remainingSeconds / durationSeconds : 0;
  const offset = circumference * (1 - progress);
  const elapsedRatio = 1 - progress;
  const angle = elapsedRatio * Math.PI * 2;
  const handLength = 72;
  const handX = 120 + Math.sin(angle) * handLength;
  const handY = 120 - Math.cos(angle) * handLength;

  return (
    <div className="mx-auto grid w-full max-w-xl place-items-center">
      <div className="relative aspect-square w-full max-w-[430px]">
        <svg className="h-full w-full drop-shadow-sm" viewBox="0 0 240 240" role="img" aria-label="ポモドーロタイマー">
          <circle cx="120" cy="120" r={radius} fill="#ffffff" stroke="#e2e8f0" strokeWidth="14" />
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth="14"
            transform="rotate(-90 120 120)"
          />
          {Array.from({ length: 12 }).map((_, index) => {
            const tickAngle = (index / 12) * Math.PI * 2;
            const inner = index % 3 === 0 ? 82 : 88;
            const outer = 98;
            return (
              <line
                key={index}
                stroke="#94a3b8"
                strokeLinecap="round"
                strokeWidth={index % 3 === 0 ? 3 : 2}
                x1={120 + Math.sin(tickAngle) * inner}
                x2={120 + Math.sin(tickAngle) * outer}
                y1={120 - Math.cos(tickAngle) * inner}
                y2={120 - Math.cos(tickAngle) * outer}
              />
            );
          })}
          <line x1="120" x2={handX} y1="120" y2={handY} stroke={color} strokeLinecap="round" strokeWidth="5" />
          <circle cx="120" cy="120" r="7" fill={color} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-md bg-white/95 px-6 py-4 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className="font-mono text-6xl font-bold leading-none text-ink sm:text-7xl">{formatTimer(remainingSeconds)}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">残り時間</p>
          </div>
        </div>
      </div>
    </div>
  );
}
