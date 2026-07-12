"use client";

import { FormEvent, useState } from "react";
import { todayString } from "@/lib/api";

const DEFAULT_STUDY_SUBJECT = "テクノロジ系";

export type StudyInput = { subject: string; study_minutes: number; studied_at: string; memo: string };

export function StudyForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Partial<StudyInput>;
  onSubmit: (data: StudyInput) => Promise<void>;
  submitting?: boolean;
}) {
  const [form, setForm] = useState<StudyInput>({
    subject: initial?.subject ?? DEFAULT_STUDY_SUBJECT,
    study_minutes: initial?.study_minutes ?? 30,
    studied_at: initial?.studied_at ?? todayString(),
    memo: initial?.memo ?? "",
  });
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.study_minutes < 1 || form.study_minutes > 1440) return setError("学習時間は1分から1440分で入力してください");
    if (form.studied_at > todayString()) return setError("未来の日付は指定できません");
    if (form.memo.length > 500) return setError("メモは500文字以内で入力してください");
    try {
      await onSubmit({ ...form, subject: form.subject || DEFAULT_STUDY_SUBJECT });
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存できませんでした");
    }
  }

  return (
    <form className="panel grid gap-4" onSubmit={submit}>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label className="grid gap-1 text-sm font-semibold">
        学習時間（分）
        <input
          className="field"
          max={1440}
          min={1}
          type="number"
          value={form.study_minutes}
          onChange={(event) => setForm({ ...form, study_minutes: Number(event.target.value) })}
        />
      </label>

      <label className="grid gap-1 text-sm font-semibold">
        学習日
        <input
          className="field"
          max={todayString()}
          type="date"
          value={form.studied_at}
          onChange={(event) => setForm({ ...form, studied_at: event.target.value })}
        />
      </label>

      <label className="grid gap-1 text-sm font-semibold">
        メモ
        <textarea className="field min-h-28" maxLength={500} value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
      </label>

      <button className="btn-primary" disabled={submitting}>
        {submitting ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
