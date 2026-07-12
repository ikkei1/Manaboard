"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects } from "@/lib/api";

type CardStatus = "new" | "learning" | "mastered";

type Flashcard = {
  id: string;
  subject: string;
  term: string;
  definition: string;
  exam_point: string;
  status: CardStatus;
  review_count: number;
  correct_count: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type FlashcardResponse = {
  items: Flashcard[];
  stats: { total: number; new: number; learning: number; mastered: number };
};

const statusOptions: { value: "" | CardStatus; label: string }[] = [
  { value: "", label: "すべて" },
  { value: "new", label: "未習得" },
  { value: "learning", label: "復習" },
  { value: "mastered", label: "習得" },
];

const statusLabels: Record<CardStatus, string> = {
  new: "未習得",
  learning: "復習",
  mastered: "習得",
};

function accuracy(card: Flashcard) {
  if (!card.review_count) return 0;
  return Math.round((card.correct_count / card.review_count) * 100);
}

export default function FlashcardsPage() {
  const [data, setData] = useState<FlashcardResponse | null>(null);
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<"" | CardStatus>("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [generateSubject, setGenerateSubject] = useState(subjects[0]);
  const [generateCount, setGenerateCount] = useState(5);
  const [generateFocus, setGenerateFocus] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const cards = data?.items ?? [];
  const current = cards[selectedIndex] ?? null;

  const priorityCardIndex = useMemo(() => {
    const learningIndex = cards.findIndex((card) => card.status === "learning");
    if (learningIndex >= 0) return learningIndex;
    const newIndex = cards.findIndex((card) => card.status === "new");
    return newIndex >= 0 ? newIndex : 0;
  }, [cards]);

  async function load(nextSubject = subject, nextStatus = status) {
    const params = new URLSearchParams();
    if (nextSubject) params.set("subject", nextSubject);
    if (nextStatus) params.set("status", nextStatus);
    const response = await apiFetch<FlashcardResponse>(`/flashcards?${params}`);
    setData(response);
    setSelectedIndex(0);
    setRevealed(false);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [subject, status]);

  useEffect(() => {
    if (cards.length) setSelectedIndex(priorityCardIndex);
  }, [cards.length, priorityCardIndex]);

  async function generateCards(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await apiFetch<{ added: number }>("/flashcards/generate", {
        method: "POST",
        body: JSON.stringify({
          subject: generateSubject,
          count: generateCount,
          focus: generateFocus || null,
        }),
      });
      setSubject(generateSubject);
      setStatus("");
      await load(generateSubject, "");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function review(remembered: boolean) {
    if (!current) return;
    setBusy(true);
    setMessage("");
    try {
      await apiFetch(`/flashcards/${current.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ remembered }),
      });
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function selectCard(index: number) {
    setSelectedIndex(index);
    setRevealed(false);
  }

  function resetFilters() {
    setSubject("");
    setStatus("");
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (!current || busy || target?.closest("button, input, select, textarea, summary")) return;

      if ((event.key === " " || event.key === "Enter") && !revealed) {
        event.preventDefault();
        setRevealed(true);
      } else if (event.key === "ArrowLeft" && selectedIndex > 0) {
        selectCard(selectedIndex - 1);
      } else if (event.key === "ArrowRight" && selectedIndex < cards.length - 1) {
        selectCard(selectedIndex + 1);
      } else if (revealed && event.key === "1") {
        void review(false);
      } else if (revealed && event.key === "2") {
        void review(true);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [busy, cards.length, current, revealed, selectedIndex]);

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-ink">単語帳</h1>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div aria-modal="true" className="panel w-full max-w-lg" role="dialog">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title mb-0 inline-flex items-center gap-2">
                <Icon name="settings" size={20} />
                表示設定
              </h2>
              <button aria-label="表示設定を閉じる" className="btn-secondary h-11 w-11 px-0" onClick={() => setFilterOpen(false)} type="button">
                <Icon name="x" size={19} />
              </button>
            </div>

            <div className="mt-5 grid gap-5 border-t border-slate-200 pt-5">
              <label className="grid gap-1">
                <span className="label">分野</span>
                <select className="field" value={subject} onChange={(event) => setSubject(event.target.value)}>
                  <option value="">すべての分野</option>
                  {subjects.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <div>
                <p className="label">状態</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {statusOptions.map((option) => (
                    <button
                      className={`segment-button ${status === option.value ? "segment-on" : "segment-off"}`}
                      key={option.value || "all"}
                      onClick={() => setStatus(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button className="btn-secondary gap-2" onClick={resetFilters} type="button">
                  <Icon name="x" size={18} />
                  初期化
                </button>
                <button className="btn-primary" onClick={() => setFilterOpen(false)} type="button">完了</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="panel relative mb-5 overflow-hidden p-4 sm:p-8">
        {!current ? (
          <div className="grid min-h-[540px] place-items-center text-center">
            <Icon className="text-slate-500" name="cards" size={52} />
            <button
              aria-label="表示設定"
              className="btn-secondary absolute right-4 top-4 h-10 w-10 px-0 sm:right-8 sm:top-8"
              onClick={() => setFilterOpen(true)}
              title="表示設定"
              type="button"
            >
              <Icon name="settings" size={19} />
            </button>
          </div>
        ) : (
          <div className="mx-auto grid max-w-4xl gap-5">
            <div className="grid grid-cols-[44px_1fr_44px_40px] items-center gap-3">
              <button
                aria-label="前の単語"
                className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-focus hover:text-focus disabled:opacity-30"
                disabled={selectedIndex <= 0}
                onClick={() => selectCard(selectedIndex - 1)}
                title="前へ"
                type="button"
              >
                <Icon name="chevronLeft" size={21} />
              </button>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-500">
                  <span>{selectedIndex + 1}/{cards.length}</span>
                  <span>{Math.round(((selectedIndex + 1) / cards.length) * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-focus transition-all" style={{ width: `${((selectedIndex + 1) / cards.length) * 100}%` }} />
                </div>
              </div>
              <button
                aria-label="次の単語"
                className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-focus hover:text-focus disabled:opacity-30"
                disabled={selectedIndex >= cards.length - 1}
                onClick={() => selectCard(selectedIndex + 1)}
                title="次へ"
                type="button"
              >
                <Icon name="chevronRight" size={21} />
              </button>
              <button
                aria-label="表示設定"
                className="btn-secondary h-10 w-10 px-0"
                onClick={() => setFilterOpen(true)}
                title="表示設定"
                type="button"
              >
                <Icon name="settings" size={19} />
              </button>
            </div>

            <button
              aria-label={revealed ? "単語と答え" : "答えを見る"}
              className="grid h-[460px] w-full place-items-center overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-7 text-center transition hover:border-focus hover:bg-white sm:p-12"
              onClick={() => !revealed && setRevealed(true)}
              type="button"
            >
              {!revealed ? (
                <div className="w-full">
                  <h2 className="break-words text-5xl font-bold text-ink sm:text-7xl">{current.term}</h2>
                  <span className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                    <Icon name="book" size={18} />
                    答えを見る
                  </span>
                </div>
              ) : (
                <div className="w-full max-w-3xl text-left">
                  <p className="text-center text-2xl font-bold text-slate-500">{current.term}</p>
                  <p className="mt-7 border-t border-slate-200 pt-7 text-2xl font-bold leading-relaxed text-ink">{current.definition}</p>
                  <p className="mt-5 rounded-md bg-blue-50 p-4 font-semibold leading-relaxed text-blue-950">{current.exam_point}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="status-pill">{current.subject}</span>
                    <span className="status-pill">{statusLabels[current.status]}</span>
                    <span className="status-pill">{accuracy(current)}%</span>
                  </div>
                </div>
              )}
            </button>

            <div className="h-14">
              {revealed && (
                <div className="grid grid-cols-2 gap-3">
                  <button className="action-danger gap-2" disabled={busy} onClick={() => review(false)} type="button">
                    <Icon name="clock" size={22} />
                    もう一度
                  </button>
                  <button className="action-primary gap-2" disabled={busy} onClick={() => review(true)} type="button">
                    <Icon name="check" size={22} />
                    覚えた
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {message && <p className="notice mb-5 mt-0">{message}</p>}

      <section className="mb-5 grid grid-cols-4 divide-x divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
        <DeckStat title="総数" value={data?.stats.total ?? 0} />
        <DeckStat title="未習得" value={data?.stats.new ?? 0} />
        <DeckStat title="復習" value={data?.stats.learning ?? 0} />
        <DeckStat title="習得" value={data?.stats.mastered ?? 0} />
      </section>

      <section>
        <form className="panel grid gap-4" onSubmit={generateCards}>
          <h2 className="section-title mb-0 inline-flex items-center gap-2">
            <Icon name="spark" size={21} />
            AIで単語を作成
          </h2>

          <button className="action-primary gap-2" disabled={busy}>
            <Icon name="spark" size={22} />
            {busy ? "作成中..." : "作成"}
          </button>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="grid gap-1">
              <span className="label">分野</span>
              <select className="field" value={generateSubject} onChange={(event) => setGenerateSubject(event.target.value)}>
                {subjects.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">語数</span>
              <select className="field min-w-28" value={generateCount} onChange={(event) => setGenerateCount(Number(event.target.value))}>
                {[3, 5, 8, 10].map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1">
            <span className="label">重点</span>
            <input className="field" placeholder="例: 計算問題 / セキュリティ用語 / 科目B" value={generateFocus} onChange={(event) => setGenerateFocus(event.target.value)} />
          </label>
        </form>
      </section>
    </Shell>
  );
}

function DeckStat({ title, value }: { title: string; value: number }) {
  return (
    <div className="min-w-0 px-2 py-4 text-center sm:px-4">
      <p className="truncate text-xs font-bold text-slate-500 sm:text-sm">{title}</p>
      <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">{value}</p>
    </div>
  );
}
