"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Shell } from "@/components/Shell";
import { apiFetch, todayString } from "@/lib/api";

type TimerMode = "focus" | "short" | "long";
type StudyLog = { id: string; study_minutes: number; studied_at: string; memo?: string };
type StudyList = { items: StudyLog[]; total: number; page: number; page_size: number };

const DEFAULT_STUDY_SUBJECT = "テクノロジ系";
const modeLabels: Record<TimerMode, string> = { focus: "集中", short: "休憩", long: "長めの休憩" };
const modeColors: Record<TimerMode, string> = { focus: "#2563eb", short: "#059669", long: "#0f766e" };

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function currentSetNumber(mode: TimerMode, completedFocusCount: number) {
  if (mode === "long" && completedFocusCount > 0) return 4;
  if (mode === "short" && completedFocusCount > 0) return ((completedFocusCount - 1) % 4) + 1;
  return (completedFocusCount % 4) + 1;
}

export default function StudyPage() {
  const [data, setData] = useState<StudyList | null>(null);
  const [page, setPage] = useState(1);
  const [studiedAt, setStudiedAt] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [memo, setMemo] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [timerMode, setTimerMode] = useState<TimerMode>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocusCount, setCompletedFocusCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const completingRef = useRef(false);
  const segmentStartRemainingRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const remainingSecondsRef = useRef(25 * 60);
  const timerModeRef = useRef<TimerMode>("focus");
  const memoRef = useRef("");
  const pauseAndSaveRef = useRef<(refreshHistory: boolean, keepalive: boolean, updateScreen: boolean) => void>(() => {});

  const durationSeconds = (
    timerMode === "focus"
      ? focusMinutes
      : timerMode === "short"
        ? shortBreakMinutes
        : longBreakMinutes
  ) * 60;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  const load = useCallback(async (requestedPage = page) => {
    const params = new URLSearchParams({ page: String(requestedPage) });
    if (studiedAt) params.set("studied_at", studiedAt);
    setData(await apiFetch<StudyList>(`/study?${params}`));
  }, [page, studiedAt]);

  const getCurrentRemaining = useCallback(() => {
    if (!endAtRef.current) return remainingSecondsRef.current;
    return Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
  }, []);

  const saveFocusSession = useCallback(async (seconds: number, refreshHistory: boolean, keepalive: boolean) => {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    await apiFetch("/study", {
      method: "POST",
      body: JSON.stringify({
        subject: DEFAULT_STUDY_SUBJECT,
        study_minutes: minutes,
        studied_at: todayString(),
        memo: memoRef.current.trim() || null,
      }),
      keepalive,
    });
    if (refreshHistory) {
      setPage(1);
      await load(1);
    }
  }, [load]);

  const flushFocusSegment = useCallback(async (secondsRemaining: number, refreshHistory: boolean, keepalive: boolean) => {
    const segmentStart = segmentStartRemainingRef.current;
    segmentStartRemainingRef.current = null;
    if (timerModeRef.current !== "focus" || segmentStart === null) return;
    const elapsedSeconds = Math.max(0, segmentStart - secondsRemaining);
    if (elapsedSeconds < 1) return;
    await saveFocusSession(elapsedSeconds, refreshHistory, keepalive);
  }, [saveFocusSession]);

  const pauseAndSave = useCallback((refreshHistory: boolean, keepalive: boolean, updateScreen: boolean) => {
    if (!isRunningRef.current) return;
    const seconds = getCurrentRemaining();
    remainingSecondsRef.current = seconds;
    isRunningRef.current = false;
    endAtRef.current = null;
    if (updateScreen) {
      setRemainingSeconds(seconds);
      setIsRunning(false);
    }
    void flushFocusSegment(seconds, refreshHistory, keepalive).catch((error) => {
      if (updateScreen) setErrorMessage((error as Error).message);
    });
  }, [flushFocusSegment, getCurrentRemaining]);

  useEffect(() => {
    pauseAndSaveRef.current = pauseAndSave;
  }, [pauseAndSave]);

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    timerModeRef.current = timerMode;
  }, [timerMode]);

  useEffect(() => {
    memoRef.current = memo;
  }, [memo]);

  useEffect(() => {
    load().catch((error) => setErrorMessage((error as Error).message));
  }, [load]);

  useEffect(() => {
    if (!isRunning) return;
    const updateRemaining = () => {
      if (!endAtRef.current) return;
      const seconds = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      remainingSecondsRef.current = seconds;
      setRemainingSeconds(seconds);
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || remainingSeconds !== 0 || completingRef.current) return;
    completingRef.current = true;
    setIsRunning(false);
    isRunningRef.current = false;
    endAtRef.current = null;
    void completeSession().finally(() => {
      completingRef.current = false;
    });
  }, [isRunning, remainingSeconds]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") pauseAndSaveRef.current(false, true, true);
    };
    const handlePageHide = () => pauseAndSaveRef.current(false, true, false);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      pauseAndSaveRef.current(false, true, false);
    };
  }, []);

  function startTimer() {
    const seconds = remainingSeconds > 0 ? remainingSeconds : durationSeconds;
    setErrorMessage("");
    setRemainingSeconds(seconds);
    remainingSecondsRef.current = seconds;
    endAtRef.current = Date.now() + seconds * 1000;
    segmentStartRemainingRef.current = seconds;
    setIsRunning(true);
    isRunningRef.current = true;
  }

  function pauseTimer() {
    pauseAndSave(true, false, true);
  }

  function resetTimer() {
    setIsRunning(false);
    isRunningRef.current = false;
    endAtRef.current = null;
    completingRef.current = false;
    segmentStartRemainingRef.current = null;
    setTimerMode("focus");
    timerModeRef.current = "focus";
    setRemainingSeconds(focusMinutes * 60);
    remainingSecondsRef.current = focusMinutes * 60;
    setCompletedFocusCount(0);
    setErrorMessage("");
    setSettingsOpen(false);
  }

  function setTimerMinutes(minutes: number) {
    const bounded = Math.max(1, Math.min(180, minutes || 1));
    setFocusMinutes(bounded);
    if (!isRunning && timerMode === "focus") {
      setRemainingSeconds(bounded * 60);
      remainingSecondsRef.current = bounded * 60;
    }
  }

  function setBreakTimerMinutes(mode: Exclude<TimerMode, "focus">, minutes: number) {
    const bounded = Math.max(1, Math.min(60, minutes || 1));
    if (mode === "short") setShortBreakMinutes(bounded);
    else setLongBreakMinutes(bounded);
    if (!isRunning && timerMode === mode) {
      setRemainingSeconds(bounded * 60);
      remainingSecondsRef.current = bounded * 60;
    }
  }

  function prepareMode(nextMode: TimerMode) {
    const nextMinutes = nextMode === "focus"
      ? focusMinutes
      : nextMode === "short"
        ? shortBreakMinutes
        : longBreakMinutes;
    setTimerMode(nextMode);
    timerModeRef.current = nextMode;
    setRemainingSeconds(nextMinutes * 60);
    remainingSecondsRef.current = nextMinutes * 60;
    segmentStartRemainingRef.current = null;
  }

  async function completeSession() {
    try {
      if (timerMode === "focus") {
        const nextCount = completedFocusCount + 1;
        const nextMode: Exclude<TimerMode, "focus"> = nextCount % 4 === 0 ? "long" : "short";
        await flushFocusSegment(0, true, false);
        setMemo("");
        memoRef.current = "";
        setCompletedFocusCount(nextCount);
        prepareMode(nextMode);
        return;
      }
      prepareMode("focus");
    } catch (error) {
      setErrorMessage((error as Error).message);
      setRemainingSeconds(durationSeconds);
      remainingSecondsRef.current = durationSeconds;
      segmentStartRemainingRef.current = null;
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
          isBreak={timerMode !== "focus"}
          actionLabel={remainingSeconds === durationSeconds ? "開始" : "再開"}
          label={modeLabels[timerMode]}
          onStart={startTimer}
          remainingSeconds={remainingSeconds}
          setLabel={`セット ${currentSetNumber(timerMode, completedFocusCount)} / 4`}
          showAction={!isRunning}
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
            onClick={pauseTimer}
            type="button"
          >
            <span>
              <Icon className="mx-auto mb-2" name="pause" size={22} />
              一時停止
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
                <p className="label">集中時間</p>
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

              <div>
                <p className="label">休憩時間</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-slate-500">短い休憩</span>
                    <input
                      className="field"
                      disabled={isRunning}
                      max={60}
                      min={1}
                      onChange={(event) => setBreakTimerMinutes("short", Number(event.target.value))}
                      type="number"
                      value={shortBreakMinutes}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-slate-500">長い休憩</span>
                    <input
                      className="field"
                      disabled={isRunning}
                      max={60}
                      min={1}
                      onChange={(event) => setBreakTimerMinutes("long", Number(event.target.value))}
                      type="number"
                      value={longBreakMinutes}
                    />
                  </label>
                </div>
              </div>

              <label className="block">
                <span className="label">メモ</span>
                <input className="field mt-1" value={memo} onChange={(event) => setMemo(event.target.value)} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button className="btn-secondary gap-2" onClick={resetTimer} type="button">
                  <Icon name="timer" size={18} />
                  リセット
                </button>
                <button className="btn-primary" onClick={() => setSettingsOpen(false)} type="button">完了</button>
              </div>
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
  actionLabel,
  color,
  durationSeconds,
  isBreak,
  label,
  onStart,
  remainingSeconds,
  setLabel,
  showAction,
}: {
  actionLabel: string;
  color: string;
  durationSeconds: number;
  isBreak: boolean;
  label: string;
  onStart: () => void;
  remainingSeconds: number;
  setLabel: string;
  showAction: boolean;
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
          {showAction ? (
            <button
              className={`grid h-[68%] w-[68%] place-items-center rounded-full text-xl font-bold text-white shadow-lg transition focus:outline-none focus:ring-4 sm:text-3xl ${
                isBreak
                  ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-200"
                  : "bg-focus hover:bg-blue-700 focus:ring-blue-200"
              }`}
              onClick={onStart}
              type="button"
            >
              {actionLabel === "再開" ? (
                <span>
                  <span className="block font-mono text-4xl font-normal sm:text-5xl">{formatTimer(remainingSeconds)}</span>
                  <span className="mt-4 inline-flex items-center gap-2 text-base sm:text-lg">
                    <Icon name="play" size={21} />
                    再開
                  </span>
                  <span className="mt-3 block text-sm font-bold text-white/85">{label}</span>
                  <span className="mt-1 block text-xs font-semibold text-white/70">{setLabel}</span>
                </span>
              ) : (
                <span>
                  <Icon className="mx-auto mb-3" name="play" size={32} />
                  <span className="block">開始</span>
                  <span className="mt-3 block text-sm font-bold text-white/85">{label}</span>
                  <span className="mt-1 block text-xs font-semibold text-white/70">{setLabel}</span>
                </span>
              )}
            </button>
          ) : (
            <div className="text-center">
              <span className="block font-mono text-6xl font-normal leading-none text-ink sm:text-8xl">{formatTimer(remainingSeconds)}</span>
              <span className="mt-4 block text-sm font-bold text-slate-500">{label}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-400">{setLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
