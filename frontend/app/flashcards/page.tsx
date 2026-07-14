"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects } from "@/lib/api";

type CardStatus = "new" | "learning";

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
  next_review_at: string | null;
  created_at: string;
  updated_at: string;
};

type FlashcardResponse = {
  items: Flashcard[];
  stats: { total: number; new: number; learning: number };
};

type GenerateFlashcardsResponse = {
  added: number;
  items: Flashcard[];
};

const statusOptions: { value: "" | CardStatus; label: string }[] = [
  { value: "", label: "今日の復習" },
  { value: "new", label: "未学習の単語" },
  { value: "learning", label: "学習済みの単語" },
];

const statusLabels: Record<CardStatus, string> = {
  new: "未学習",
  learning: "学習済み",
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
  const [reviewedCards, setReviewedCards] = useState<Flashcard[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(0);
  const [sessionKind, setSessionKind] = useState<"today" | "repeat" | "extra">("today");
  const generatedCardIdsRef = useRef<string[]>([]);

  const cards = data?.items ?? [];
  const current = cards[selectedIndex] ?? null;
  const progressPercent = sessionTotal ? Math.round((sessionCompleted / sessionTotal) * 100) : 0;

  async function load(nextSubject = subject, nextStatus = status) {
    const params = new URLSearchParams();
    if (nextSubject) params.set("subject", nextSubject);
    if (nextStatus) params.set("status", nextStatus);
    const response = await apiFetch<FlashcardResponse>(`/flashcards?${params}`, { cache: "no-store" });
    const generatedOrder = new Map(generatedCardIdsRef.current.map((id, index) => [id, index]));
    const items = generatedOrder.size
      ? [...response.items].sort((left, right) => {
          const leftOrder = generatedOrder.get(left.id);
          const rightOrder = generatedOrder.get(right.id);
          if (leftOrder === undefined && rightOrder === undefined) return 0;
          if (leftOrder === undefined) return 1;
          if (rightOrder === undefined) return -1;
          return leftOrder - rightOrder;
        })
      : response.items;
    setData({ ...response, items });
    setSelectedIndex(0);
    setRevealed(false);
    setReviewedCards([]);
    setSessionTotal(items.length);
    setSessionCompleted(0);
    setSessionKind("today");
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [subject, status]);

  async function generateCards(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const generated = await apiFetch<GenerateFlashcardsResponse>("/flashcards/generate", {
        method: "POST",
        body: JSON.stringify({
          subject: generateSubject,
          count: generateCount,
          focus: generateFocus || null,
        }),
      });
      generatedCardIdsRef.current = generated.items.map((card) => card.id);
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
      const reviewed = await apiFetch<Flashcard>(`/flashcards/${current.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ remembered }),
      });
      setReviewedCards((previous) => [...previous.filter((card) => card.id !== reviewed.id), reviewed]);
      setData((previous) => {
        if (!previous) return previous;
        const nextStats = { ...previous.stats };
        if (current.status !== reviewed.status) {
          nextStats[current.status] = Math.max(0, nextStats[current.status] - 1);
          nextStats[reviewed.status] += 1;
        }
        return {
          items: previous.items.filter((card) => card.id !== current.id),
          stats: nextStats,
        };
      });
      setSelectedIndex((index) => Math.min(index, Math.max(0, cards.length - 2)));
      setSessionCompleted((completed) => Math.min(sessionTotal, completed + 1));
      setRevealed(false);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function restartReview() {
    if (!data || reviewedCards.length === 0) return;
    setData({ ...data, items: reviewedCards });
    setSessionTotal(reviewedCards.length);
    setSessionCompleted(0);
    setSessionKind("repeat");
    setReviewedCards([]);
    setSelectedIndex(0);
    setRevealed(false);
  }

  async function startDifferentReview() {
    if (!data || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ practice: "true" });
      if (subject) params.set("subject", subject);
      const response = await apiFetch<FlashcardResponse>(`/flashcards?${params}`, { cache: "no-store" });
      const reviewedIds = new Set(reviewedCards.map((card) => card.id));
      const differentCards = response.items.filter((card) => !reviewedIds.has(card.id));
      const candidates = differentCards.length > 0 ? differentCards : response.items;
      const items = candidates.slice(0, 10);
      setData({ ...response, items });
      setReviewedCards([]);
      setSelectedIndex(0);
      setRevealed(false);
      setSessionTotal(items.length);
      setSessionCompleted(0);
      setSessionKind("extra");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCurrent() {
    if (!current || busy || !window.confirm(`「${current.term}」を削除しますか？`)) return;
    setBusy(true);
    setMessage("");
    try {
      await apiFetch<void>(`/flashcards/${current.id}`, { method: "DELETE" });
      setReviewedCards((previous) => previous.filter((card) => card.id !== current.id));
      setData((previous) => {
        if (!previous) return previous;
        return {
          items: previous.items.filter((card) => card.id !== current.id),
          stats: {
            ...previous.stats,
            total: Math.max(0, previous.stats.total - 1),
            [current.status]: Math.max(0, previous.stats[current.status] - 1),
          },
        };
      });
      setSelectedIndex((index) => Math.min(index, Math.max(0, cards.length - 2)));
      setSessionTotal((total) => Math.max(sessionCompleted, total - 1));
      setRevealed(false);
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
                <div className="mt-2 grid grid-cols-3 gap-2">
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
        {!data ? (
          <div className="grid min-h-[540px] place-items-center text-center">
            <p className="font-bold text-slate-500">読み込み中...</p>
          </div>
        ) : !current ? (
          <div className="grid min-h-[540px] place-items-center text-center">
            <div>
              <Icon className="mx-auto text-slate-400" name="cards" size={52} />
              <p className="mt-4 text-lg font-bold text-slate-500">
                {status ? "対象の単語はありません" : sessionKind === "extra" ? "追加の復習は完了" : "今日の復習は完了"}
              </p>
              {!status && sessionTotal > 0 && <p className="mt-2 text-sm font-bold text-slate-400">{sessionCompleted} / {sessionTotal}</p>}
              {!status && data.stats.total > 0 && (
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {reviewedCards.length > 0 && (
                    <button className="btn-secondary gap-2" onClick={restartReview} type="button">
                      <Icon name="play" size={18} />
                      もう一度やる
                    </button>
                  )}
                  <button className="btn-primary gap-2" disabled={busy} onClick={startDifferentReview} type="button">
                    <Icon name="cards" size={18} />
                    別の問題をやる
                  </button>
                </div>
              )}
            </div>
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
                  <span>今回の進捗</span>
                  <span>{sessionCompleted}/{sessionTotal}・{progressPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-focus transition-all" style={{ width: `${progressPercent}%` }} />
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

            <div className="relative h-[460px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-focus hover:bg-white">
              <button
                aria-label={`「${current.term}」を削除`}
                className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-md border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                disabled={busy}
                onClick={deleteCurrent}
                title="単語を削除"
                type="button"
              >
                <Icon name="trash" size={19} />
              </button>
              <button
                aria-label={revealed ? "単語と答え" : "答えを見る"}
                className="grid h-full w-full place-items-center overflow-y-auto p-7 text-center sm:p-12"
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
            </div>

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

      <section className="mb-5 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
        <DeckStat title="登録単語" value={data?.stats.total ?? 0} />
        <DeckStat title="未学習" value={data?.stats.new ?? 0} />
        <DeckStat title="学習済み" value={data?.stats.learning ?? 0} />
      </section>

      <section>
        <form className="panel grid gap-4" onSubmit={generateCards}>
          <h2 className="section-title mb-0 inline-flex items-center gap-2">
            <Icon name="spark" size={21} />
            AIで単語を追加
          </h2>

          <button className="action-primary gap-2" disabled={busy}>
            <Icon name="spark" size={22} />
            {busy ? "追加中..." : "単語を追加"}
          </button>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="grid gap-1">
              <span className="label">出題分野</span>
              <select className="field" value={generateSubject} onChange={(event) => setGenerateSubject(event.target.value)}>
                {subjects.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="label">追加する語数</span>
              <select className="field min-w-28" value={generateCount} onChange={(event) => setGenerateCount(Number(event.target.value))}>
                {[3, 5, 8, 10].map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1">
            <span className="label">含めたい内容</span>
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
