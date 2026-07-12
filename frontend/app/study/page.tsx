"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Shell } from "@/components/Shell";
import { apiFetch, todayString } from "@/lib/api";

type TimerMode = "focus" | "short" | "long";
type StudyLog = { id: string; study_minutes: number; studied_at: string; memo?: string };
type StudyList = { items: StudyLog[]; total: number; page: number; page_size: number };

const DEFAULT_STUDY_SUBJECT = "テクノロジ系";
const breakMinutes: Record<Exclude<TimerMode, "focus">, number> = { short: 5, long: 15 };
const modeLabels: Record<TimerMode, string> = { focus: "集中", short: "休憩", long: "長めの休憩" };
const modeColors: Record<TimerMode, string> = { focus: "#2563eb", short: "#059669", long: "#0f766e" };

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function StudyPage() {
  const [data, setData] = useState<StudyList | null>(null);
  const [page, setPage] = useState(1);
  const [studiedAt, setStudiedAt] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [memo, setMemo] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [timerMode, setTimerMode] = useState<TimerMode>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocusCount, setCompletedFocusCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const completingRef = useRef(false);

  const durationSeconds = (timerMode === "focus" ? focusMinutes : breakMinutes[timerMode]) * 60;
  const elapsedSeconds = Math.max(0, durationSeconds - remainingSeconds);
  const focusElapsedSeconds = timerMode === "focus" ? elapsedSeconds : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  const load = useCallback(async (requestedPage = page) => {
    const params = new URLSearchParams({ page: String(requestedPage) });
    if (studiedAt) params.set("studied_at", studiedAt);
    setData(await apiFetch<StudyList>(`/study?${params}`));
  }, [page, studiedAt]);

  useEffect(() => {
    load().catch((error) => setErrorMessage((error as Error).message));
  }, [load]);

  useEffect(() => {
    if (!isRunning) return;
    const updateRemaining = () => {
      if (!endAtRef.current) return;
      setRemainingSeconds(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || remainingSeconds !== 0 || completingRef.current) return;
    completingRef.current = true;
    setIsRunning(false);
    endAtRef.current = null;
    void completeSession().finally(() => {
      completingRef.current = false;
    });
  }, [isRunning, remainingSeconds]);

  function startTimer() {
    const seconds = remainingSeconds > 0 ? remainingSeconds : durationSeconds;
    setErrorMessage("");
    setRemainingSeconds(seconds);
    endAtRef.current = Date.now() + seconds * 1000;
    setIsRunning(true);
  }

  function setTimerMinutes(minutes: number) {
    const bounded = Math.max(1, Math.min(180, minutes || 1));
    setFocusMinutes(bounded);
    if (!isRunning && timerMode === "focus") setRemainingSeconds(bounded * 60);
  }

  function prepareMode(nextMode: TimerMode) {
    setTimerMode(nextMode);
    setRemainingSeconds((nextMode === "focus" ? focusMinutes : breakMinutes[nextMode]) * 60);
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
    setPage(1);
    await load(1);
    return minutes;
  }

  async function completeSession() {
    try {
      if (timerMode === "focus") {
        const nextCount = completedFocusCount + 1;
        const nextMode: Exclude<TimerMode, "focus"> = nextCount % 4 === 0 ? "long" : "short";
        await saveFocusSession(durationSeconds, "ポモドーロ集中完了");
        setCompletedFocusCount(nextCount);
        prepareMode(nextMode);
        return;
      }
      prepareMode("focus");
    } catch (error) {
      setErrorMessage((error as Error).message);
      setRemainingSeconds(durationSeconds);
    }
  }

  async function finishEarly() {
    if (!isRunning) return;
    setIsRunning(false);
    endAtRef.current = null;
    if (timerMode !== "focus") {
      prepareMode("focus");
      return;
    }
    if (focusElapsedSeconds <= 0) {
      setRemainingSeconds(durationSeconds);
      return;
    }
    try {
      await saveFocusSession(focusElapsedSeconds, `ポモドーロで${formatTimer(focusElapsedSeconds)}集中`);
      const nextCount = completedFocusCount + 1;
      const nextMode: Exclude<TimerMode, "focus"> = nextCount % 4 === 0 ? "long" : "short";
      setCompletedFocusCount(nextCount);
      prepareMode(nextMode);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setRemainingSeconds(durationSeconds);
    }
  }

  async function remove(id: string) {
    if (!confirm("本当に削除しますか？")) return;
    try {
      await apiFetch(`/study/${id}`, { method: "DELETE" });
      const nextPage = data?.items.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      else await load(nextPage);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  }

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-ink">学習記録</h1>
      </div>

      {errorMessage && <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{errorMessage}</p>}

      <section className="panel mb-6 px-4 py-7 sm:px-10 sm:py-9">
        <PomodoroClock
          color={modeColors[timerMode]}
          durationSeconds={durationSeconds}
          label={modeLabels[timerMode]}
          onStart={startTimer}
          remainingSeconds={remainingSeconds}
          showStart={!isRunning && remainingSeconds === durationSeconds}
        />

        <div className="relative z-10 mx-auto -mt-20 flex w-full max-w-lg items-center justify-between gap-5 px-2 sm:-mt-24 sm:px-8">
          <button
            className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-700 transition hover:border-focus hover:text-focus sm:h-28 sm:w-28"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            <span>
              <Icon className="mx-auto mb-2" name="settings" size={22} />
              設定
            </span>
          </button>

          <button
            className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-coral text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-35 sm:h-28 sm:w-28"
            disabled={!isRunning}
            onClick={finishEarly}
            type="button"
          >
            <span>
              <Icon className="mx-auto mb-2" name="x" size={22} />
              停止
            </span>
          </button>
        </div>
      </section>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div aria-modal="true" className="panel w-full max-w-lg" role="dialog">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title mb-0 inline-flex items-center gap-2">
                <Icon name="settings" size={20} />
                タイマー設定
              </h2>
              <button aria-label="設定を閉じる" className="btn-secondary h-11 w-11 px-0" onClick={() => setSettingsOpen(false)} type="button">
                <Icon name="x" size={19} />
              </button>
            </div>

            <div className="mt-5 grid gap-5 border-t border-slate-200 pt-5">
              <div>
                <p className="label">タイマー分数</p>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[15, 25, 45, 60].map((minutes) => (
                    <button
                      className={`segment-button ${focusMinutes === minutes ? "segment-on" : "segment-off"}`}
                      disabled={isRunning}
                      key={minutes}
                      onClick={() => setTimerMinutes(minutes)}
                      type="button"
                    >
                      {minutes}分
                    </button>
                  ))}
                </div>
                <input
                  className="field mt-3"
                  disabled={isRunning}
                  max={180}
                  min={1}
                  onChange={(event) => setTimerMinutes(Number(event.target.value))}
                  type="number"
                  value={focusMinutes}
                />
              </div>

              <label className="block">
                <span className="label">メモ</span>
                <input className="field mt-1" placeholder="SQL / 暗号化 / 稼働率" value={memo} onChange={(event) => setMemo(event.target.value)} />
              </label>

              <button className="btn-primary" onClick={() => setSettingsOpen(false)} type="button">完了</button>
            </div>
          </div>
        </div>
      )}

      <section className="panel mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          aria-label="学習日"
          className="field"
          type="date"
          value={studiedAt}
          onChange={(event) => {
            setPage(1);
            setStudiedAt(event.target.value);
          }}
        />
        <button className="btn-secondary" onClick={() => { setPage(1); setStudiedAt(""); }} type="button">
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
                    <button className="font-semibold text-coral" onClick={() => remove(log.id)} type="button">削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.items.length === 0 && <p className="py-4 text-slate-500">記録がありません</p>}
      </section>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">前へ</button>
        <span className="text-sm font-semibold">{page} / {pages}</span>
        <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage((current) => current + 1)} type="button">次へ</button>
      </div>

    </Shell>
  );
}

function PomodoroClock({
  color,
  durationSeconds,
  label,
  onStart,
  remainingSeconds,
  showStart,
}: {
  color: string;
  durationSeconds: number;
  label: string;
  onStart: () => void;
  remainingSeconds: number;
  showStart: boolean;
}) {
  const radius = 94;
  const circumference = Number((2 * Math.PI * radius).toFixed(3));
  const progress = durationSeconds ? remainingSeconds / durationSeconds : 0;
  const offset = Number((circumference * (1 - progress)).toFixed(3));

  return (
    <div className="mx-auto grid w-full max-w-2xl place-items-center py-5 sm:py-7">
      <div className="relative aspect-square w-full max-w-[500px]">
        <svg className="h-full w-full" viewBox="0 0 240 240" role="img" aria-label="ポモドーロタイマー">
          <circle cx="120" cy="120" r={radius} fill="#ffffff" stroke="#e2e8f0" strokeWidth="7" />
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth="7"
            transform="rotate(-90 120 120)"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          {showStart ? (
            <button
              className="grid h-[68%] w-[68%] place-items-center rounded-full bg-focus text-xl font-bold text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 sm:text-3xl"
              onClick={onStart}
              type="button"
            >
              <span>
                <Icon className="mx-auto mb-3" name="play" size={32} />
                開始
              </span>
            </button>
          ) : (
            <div className="text-center">
              <span className="block font-mono text-6xl font-normal leading-none text-ink sm:text-8xl">{formatTimer(remainingSeconds)}</span>
              <span className="mt-4 block text-sm font-bold text-slate-500">{label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
