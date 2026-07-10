"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
      const response = await apiFetch<{ added: number }>("/flashcards/generate", {
        method: "POST",
        body: JSON.stringify({
          subject: generateSubject,
          count: generateCount,
          focus: generateFocus || null,
        }),
      });
      setSubject(generateSubject);
      setStatus("");
      setMessage(`${response.added}語を追加しました`);
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
    try {
      await apiFetch(`/flashcards/${current.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ remembered }),
      });
      setMessage(remembered ? "習得にしました" : "復習にしました");
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

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-ink">単語帳</h1>
      </div>

      <section className="mb-5 grid gap-4 sm:grid-cols-4">
        <Stat title="総数" value={data?.stats.total ?? 0} />
        <Stat title="未習得" value={data?.stats.new ?? 0} />
        <Stat title="復習" value={data?.stats.learning ?? 0} />
        <Stat title="習得" value={data?.stats.mastered ?? 0} />
      </section>

      {message && <p className="notice mb-5">{message}</p>}

      <section className="panel mb-5 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select className="field" value={subject} onChange={(event) => setSubject(event.target.value)}>
            <option value="">すべての分野</option>
            {subjects.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <button
            className="btn-secondary"
            onClick={() => {
              setSubject("");
              setStatus("");
            }}
            type="button"
          >
            クリア
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
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
      </section>

      <section className="mb-6">
        <div className="panel grid min-h-[460px] gap-5">
          {!current ? (
            <div className="grid place-items-center rounded-md border border-slate-200 bg-slate-50 text-center">
              <p className="text-xl font-bold text-slate-500">なし</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className="status-pill">{current.subject}</span>
                  <span className="status-pill">{statusLabels[current.status]}</span>
                  <span className="status-pill">{accuracy(current)}%</span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" disabled={selectedIndex <= 0} onClick={() => selectCard(selectedIndex - 1)} type="button">
                    前へ
                  </button>
                  <button className="btn-secondary" disabled={selectedIndex >= cards.length - 1} onClick={() => selectCard(selectedIndex + 1)} type="button">
                    次へ
                  </button>
                </div>
              </div>

              <div className="grid min-h-80 place-items-center rounded-md border border-slate-200 bg-slate-50 p-6 text-center">
                <div className="w-full max-w-2xl">
                  <p className="text-sm font-bold text-slate-500">{current.subject}</p>
                  <h2 className="mt-4 text-5xl font-bold text-ink sm:text-6xl">{current.term}</h2>
                  {revealed && (
                    <div className="mt-6 grid gap-3 text-left">
                      <p className="rounded-md bg-white p-4 text-lg font-semibold leading-relaxed">{current.definition}</p>
                      <p className="rounded-md border border-blue-100 bg-blue-50 p-4 font-semibold text-blue-950">{current.exam_point}</p>
                    </div>
                  )}
                </div>
              </div>

              {!revealed ? (
                <button className="action-primary" onClick={() => setRevealed(true)} type="button">
                  答えを見る
                </button>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button className="action-danger" disabled={busy} onClick={() => review(false)} type="button">
                    苦手
                  </button>
                  <button className="action-primary bg-emerald-700 hover:bg-emerald-800" disabled={busy} onClick={() => review(true)} type="button">
                    覚えた
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <form className="panel grid gap-4" onSubmit={generateCards}>
        <h2 className="section-title mb-0">AIで追加</h2>
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
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1">
          <span className="label">重点</span>
          <input className="field" placeholder="例: 計算問題 / セキュリティ用語 / 科目B" value={generateFocus} onChange={(event) => setGenerateFocus(event.target.value)} />
        </label>
        <button className="action-primary" disabled={busy}>
          {busy ? "追加中..." : "単語を追加"}
        </button>
      </form>
    </Shell>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="panel">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
