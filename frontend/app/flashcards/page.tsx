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

type FormState = {
  subject: string;
  term: string;
  definition: string;
  exam_point: string;
  status: CardStatus;
};

const emptyForm: FormState = {
  subject: subjects[0],
  term: "",
  definition: "",
  exam_point: "",
  status: "new",
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
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  async function load() {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    const response = await apiFetch<FlashcardResponse>(`/flashcards?${params}`);
    setData(response);
    setSelectedIndex(0);
    setRevealed(false);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [subject, status, query]);

  useEffect(() => {
    if (cards.length) setSelectedIndex(priorityCardIndex);
  }, [cards.length, priorityCardIndex]);

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

  async function saveCard(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        await apiFetch(`/flashcards/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await apiFetch("/flashcards", {
          method: "POST",
          body: JSON.stringify({
            subject: form.subject,
            term: form.term,
            definition: form.definition,
            exam_point: form.exam_point,
          }),
        });
      }
      setForm(emptyForm);
      setEditingId(null);
      setSubject("");
      setStatus("");
      setQuery("");
      setMessage(editingId ? "更新しました" : "追加しました");
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeCard(card: Flashcard) {
    if (!confirm(`${card.term}を削除しますか？`)) return;
    await apiFetch(`/flashcards/${card.id}`, { method: "DELETE" });
    setMessage("削除しました");
    await load();
  }

  function selectCard(index: number) {
    setSelectedIndex(index);
    setRevealed(false);
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id);
    setForm({
      subject: card.subject,
      term: card.term,
      definition: card.definition,
      exam_point: card.exam_point,
      status: card.status,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-focus">基本情報技術者試験</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">単語帳</h1>
        </div>
        <div className="status-pill">{data?.stats.total ?? 0}語</div>
      </div>

      {message && <p className="notice mb-5">{message}</p>}

      <section className="mb-5 grid gap-4 sm:grid-cols-4">
        <Stat title="総数" value={data?.stats.total ?? 0} />
        <Stat title="未習得" value={data?.stats.new ?? 0} />
        <Stat title="復習" value={data?.stats.learning ?? 0} />
        <Stat title="習得" value={data?.stats.mastered ?? 0} />
      </section>

      <section className="mb-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="panel grid min-h-[380px] gap-5">
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

              <div className="grid min-h-64 place-items-center rounded-md border border-slate-200 bg-slate-50 p-6 text-center">
                <div className="w-full max-w-2xl">
                  <p className="text-sm font-bold text-focus">{current.subject}</p>
                  <h2 className="mt-4 text-4xl font-bold text-ink">{current.term}</h2>
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

        <form className="panel h-fit grid gap-3" onSubmit={saveCard}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{editingId ? "編集" : "追加"}</h2>
            {editingId && (
              <button className="font-semibold text-slate-500" onClick={cancelEdit} type="button">
                解除
              </button>
            )}
          </div>
          <label className="grid gap-1">
            <span className="label">分野</span>
            <select className="field" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}>
              {subjects.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">用語</span>
            <input className="field" required value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })} />
          </label>
          <label className="grid gap-1">
            <span className="label">意味</span>
            <textarea className="field min-h-24" required value={form.definition} onChange={(event) => setForm({ ...form, definition: event.target.value })} />
          </label>
          <label className="grid gap-1">
            <span className="label">重点</span>
            <textarea className="field min-h-20" required value={form.exam_point} onChange={(event) => setForm({ ...form, exam_point: event.target.value })} />
          </label>
          {editingId && (
            <label className="grid gap-1">
              <span className="label">状態</span>
              <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CardStatus })}>
                {statusOptions.slice(1).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="btn-primary" disabled={busy}>
            {editingId ? "更新" : "追加"}
          </button>
        </form>
      </section>

      <section className="panel mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <select className="field" value={subject} onChange={(event) => setSubject(event.target.value)}>
          <option value="">すべての分野</option>
          {subjects.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <input className="field" placeholder="検索" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button
          className="btn-secondary"
          onClick={() => {
            setSubject("");
            setStatus("");
            setQuery("");
          }}
          type="button"
        >
          クリア
        </button>
        <div className="flex flex-wrap gap-2 md:col-span-3">
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

      <section className="grid gap-3 md:grid-cols-2">
        {cards.map((card, index) => (
          <article className={`rounded-md border bg-white p-4 shadow-sm ${selectedIndex === index ? "border-focus" : "border-slate-200"}`} key={card.id}>
            <div className="flex items-start justify-between gap-3">
              <button className="min-w-0 text-left" onClick={() => selectCard(index)} type="button">
                <p className="text-sm font-semibold text-focus">{card.subject} ・ {statusLabels[card.status]}</p>
                <h3 className="mt-1 text-lg font-bold">{card.term}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{card.definition}</p>
              </button>
              <div className="grid gap-2 text-right">
                <button className="font-semibold text-focus" onClick={() => startEdit(card)} type="button">
                  編集
                </button>
                <button className="font-semibold text-coral" onClick={() => removeCard(card)} type="button">
                  削除
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
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
