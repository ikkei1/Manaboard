"use client";

import { FormEvent, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Shell } from "@/components/Shell";
import { API_BASE, apiFetch, subjects } from "@/lib/api";

type ExplainResult = {
  summary: unknown;
  answer: unknown;
  explanation: unknown;
  detected_problem?: unknown;
  ocr_reference?: string;
  ocr_confidence?: number;
};

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${textValue(item)}`)
      .join("\n");
  }
  return String(value);
}

function ResultBlock({
  children,
  icon,
  title,
  tone = "default",
}: {
  children: string;
  icon: IconName;
  title: string;
  tone?: "default" | "answer";
}) {
  if (!children) return null;
  return (
    <section className={tone === "answer" ? "rounded-md border border-emerald-200 bg-emerald-50 p-4" : "rounded-md border border-slate-200 bg-white p-4"}>
      <p className="label inline-flex items-center gap-2">
        <Icon name={icon} size={17} />
        {title}
      </p>
      <p className={`mt-2 whitespace-pre-wrap leading-7 ${tone === "answer" ? "font-bold text-emerald-800" : "text-slate-800"}`}>{children}</p>
    </section>
  );
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [memo, setMemo] = useState("");
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const subject = subjects[0];

  const canAnalyze = Boolean(file) && !busy;
  const fileMeta = useMemo(() => {
    if (!file) return "";
    const sizeMb = file.size / 1024 / 1024;
    return `${file.name} / ${sizeMb < 0.1 ? "<0.1" : sizeMb.toFixed(1)}MB`;
  }, [file]);

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage("");
    setResult(null);

    const body = new FormData();
    body.append("file", file);
    body.append("subject", subject);
    body.append("memo", memo);

    try {
      const response = await fetch(`${API_BASE}/ocr/analyze`, {
        method: "POST",
        body,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail ?? "画像の解析に失敗しました");
      }
      setResult(await response.json());
      setMessage("解説を生成しました");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result) return;
    await apiFetch("/ocr/save", {
      method: "POST",
      body: JSON.stringify({
        subject,
        ocr_text: result.ocr_reference || textValue(result.detected_problem),
        corrected_text: textValue(result.detected_problem) || result.ocr_reference || "",
        confidence: result.ocr_confidence ?? 0,
        ai_answer: textValue(result.answer),
        ai_explanation: textValue(result.explanation),
        similar_problem: "",
      }),
    });
    setMessage("保存しました");
  }

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-ink">画像解説</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <form className="panel grid h-fit gap-4" onSubmit={analyze}>
          <h2 className="section-title mb-0 inline-flex items-center gap-2">
            <Icon name="image" size={21} />
            画像
          </h2>

          <label>
            <span className="label">ファイル</span>
            <input
              required
              className="field mt-1"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                setFile(selected);
                setResult(null);
                setMessage("");
                setPreview(selected ? URL.createObjectURL(selected) : "");
              }}
            />
          </label>

          <div className="min-h-72 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {preview ? (
              <img src={preview} alt="" className="h-full max-h-[460px] w-full object-contain" />
            ) : (
              <div className="grid min-h-72 place-items-center text-center text-slate-400">
                <div>
                  <Icon className="mx-auto" name="image" size={46} />
                  <p className="mt-3 text-sm font-bold">画像未選択</p>
                </div>
              </div>
            )}
          </div>

          {fileMeta && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">{fileMeta}</p>}

          <label>
            <span className="label">追加指示</span>
            <textarea className="field mt-1 min-h-24" maxLength={500} value={memo} onChange={(event) => setMemo(event.target.value)} />
          </label>

          <button className="action-primary gap-2" disabled={!canAnalyze}>
            <Icon name="spark" size={22} />
            {busy ? "解析中..." : "AIで解説"}
          </button>
        </form>

        <section className="grid content-start gap-4">
          {message && <p className="notice">{message}</p>}

          {!result && (
            <div className="panel grid min-h-[420px] place-items-center text-center">
              <div>
                <Icon className="mx-auto text-slate-300" name="image" size={58} />
                <p className="mt-3 text-xl font-bold text-slate-500">未解析</p>
              </div>
            </div>
          )}

          {result && (
            <div className="grid gap-4">
              <ResultBlock icon="problems" title="読み取った問題">
                {textValue(result.detected_problem)}
              </ResultBlock>
              <ResultBlock icon="list" title="要点">
                {textValue(result.summary)}
              </ResultBlock>
              <ResultBlock icon="check" title="答え" tone="answer">
                {textValue(result.answer)}
              </ResultBlock>
              <ResultBlock icon="book" title="解き方">
                {textValue(result.explanation)}
              </ResultBlock>
              <div className="flex justify-end">
                <button className="btn-primary gap-2" onClick={save} type="button">
                  <Icon name="check" size={18} />
                  保存
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
