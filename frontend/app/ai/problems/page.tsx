"use client";

import { FormEvent, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects } from "@/lib/api";

type Problem = {
  id?: string;
  subject: string;
  unit: string;
  difficulty: string;
  format: string;
  question: string;
  choices: string[] | null;
  answer: string;
  explanation: string;
  hint?: string | null;
  steps?: string[] | string | null;
  similar_problem?: string | null;
};

type FormState = {
  subject: string;
  unit: string;
  difficulty: string;
  question_count: number;
  format: string;
  question_style: string;
  purpose: string;
  focus_points: string;
  excluded_topics: string;
  include_hints: boolean;
  include_steps: boolean;
  include_similar_problem: boolean;
};

const initialForm: FormState = {
  subject: "数学",
  unit: "",
  difficulty: "normal",
  question_count: 3,
  format: "multiple_choice",
  question_style: "standard",
  purpose: "",
  focus_points: "",
  excluded_topics: "",
  include_hints: true,
  include_steps: true,
  include_similar_problem: false,
};

const presets = [
  { label: "定期テスト", value: { question_style: "exam", difficulty: "normal", question_count: 5, include_steps: true } },
  { label: "苦手克服", value: { question_style: "weakness", difficulty: "easy", question_count: 4, include_hints: true } },
  { label: "スピード練習", value: { question_style: "speed", difficulty: "easy", question_count: 8, include_steps: false } },
  { label: "考え方重視", value: { question_style: "concept", difficulty: "normal", question_count: 3, include_steps: true } },
];

const difficultyLabels: Record<string, string> = { easy: "やさしい", normal: "標準", hard: "発展" };
const formatLabels: Record<string, string> = {
  multiple_choice: "選択式",
  written: "記述式",
  fill_blank: "穴埋め",
  true_false: "正誤判定",
};

const mistakeTypes = ["計算ミス", "読み取りミス", "知識不足", "考え方の混乱", "時間不足"];

function stepsToArray(steps: Problem["steps"]) {
  if (!steps) return [];
  return Array.isArray(steps) ? steps : [steps];
}

function normalizeAnswer(value: string) {
  return value.replace(/\s/g, "").replace(/[（）]/g, (s) => (s === "（" ? "(" : ")")).toLowerCase();
}

function savePayload(problem: Problem) {
  return {
    subject: problem.subject,
    unit: problem.unit,
    difficulty: problem.difficulty,
    format: problem.format,
    question: problem.question,
    choices: problem.choices,
    answer: problem.answer,
    explanation: problem.explanation,
  };
}

export default function Page() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [openAnswer, setOpenAnswer] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [mistakes, setMistakes] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, boolean>>({});

  const filled = useMemo(() => {
    return [form.purpose, form.focus_points, form.excluded_topics].filter(Boolean).length;
  }, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(value: Partial<FormState>) {
    setForm((current) => ({ ...current, ...value }));
  }

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        purpose: form.purpose || null,
        focus_points: form.focus_points || null,
        excluded_topics: form.excluded_topics || null,
      };
      const response = await apiFetch<{ problems: Problem[] }>("/ai/problems/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setProblems(response.problems);
      setOpenAnswer({});
      setAnswers({});
      setMistakes({});
      setResults({});
      setMessage(`${response.problems.length}問を生成しました。解いたら「分析へ記録」を押してください。`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    try {
      const unsaved = problems.filter((problem) => !problem.id);
      if (!unsaved.length) {
        setMessage("すべて保存済みです");
        return;
      }
      const response = await apiFetch<{ ids: string[] }>("/ai/problems/save", {
        method: "POST",
        body: JSON.stringify(unsaved.map(savePayload)),
      });
      let idIndex = 0;
      setProblems((current) => current.map((problem) => (problem.id ? problem : { ...problem, id: response.ids[idIndex++] })));
      setMessage("生成した問題を保存しました");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function ensureSaved(index: number) {
    const problem = problems[index];
    if (problem.id) return problem.id;
    const response = await apiFetch<{ ids: string[] }>("/ai/problems/save", {
      method: "POST",
      body: JSON.stringify([savePayload(problem)]),
    });
    const id = response.ids[0];
    setProblems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, id } : item)));
    return id;
  }

  async function submitAnswer(index: number) {
    const problem = problems[index];
    const userAnswer = answers[index]?.trim();
    if (!userAnswer) {
      setMessage("回答を入力してください");
      return;
    }

    try {
      const problemId = await ensureSaved(index);
      const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(problem.answer);
      await apiFetch(`/problems/${problemId}/answer`, {
        method: "POST",
        body: JSON.stringify({
          user_answer: userAnswer,
          is_correct: isCorrect,
          mistake_type: isCorrect ? null : mistakes[index] || "未分類",
        }),
      });
      setResults((current) => ({ ...current, [index]: isCorrect }));
      setOpenAnswer((current) => ({ ...current, [index]: true }));
      setMessage(isCorrect ? "正解として分析に記録しました" : "不正解として分析に記録しました。解説を確認しましょう。");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function loadSavedProblems() {
    try {
      const saved = await apiFetch<Problem[]>("/ai/problems");
      setProblems(saved);
      setOpenAnswer({});
      setAnswers({});
      setMistakes({});
      setResults({});
      setMessage(saved.length ? "保存済み問題を読み込みました" : "保存済み問題はまだありません");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function copyProblem(problem: Problem) {
    const choices = problem.choices?.map((choice, index) => `${index + 1}. ${choice}`).join("\n") ?? "";
    const text = [`問題: ${problem.question}`, choices, `答え: ${problem.answer}`, `解説: ${problem.explanation}`]
      .filter(Boolean)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setMessage("問題をコピーしました");
  }

  return (
    <Shell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-focus">AI問題生成</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">問題を作って、そのまま分析へ記録</h1>
          <p className="mt-2 text-slate-600">回答を入力して「分析へ記録」を押すと、正答率や苦手単元に反映されます。</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          追加条件 {filled}/3
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <form className="panel h-fit space-y-5" onSubmit={generate}>
          <div>
            <h2 className="section-title">生成条件</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <label>
                <span className="label">教科</span>
                <select className="field mt-1" value={form.subject} onChange={(e) => update("subject", e.target.value)}>
                  {subjects.map((subject) => (
                    <option key={subject}>{subject}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">単元</span>
                <input
                  className="field mt-1"
                  required
                  placeholder="例: 一次方程式、比較、電流"
                  value={form.unit}
                  onChange={(e) => update("unit", e.target.value)}
                />
              </label>
            </div>
          </div>

          <div>
            <p className="label">プリセット</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button className="chip" key={preset.label} type="button" onClick={() => applyPreset(preset.value)}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">難易度</span>
              <select className="field mt-1" value={form.difficulty} onChange={(e) => update("difficulty", e.target.value)}>
                <option value="easy">やさしい</option>
                <option value="normal">標準</option>
                <option value="hard">発展</option>
              </select>
            </label>
            <label>
              <span className="label">問題数</span>
              <input
                className="field mt-1"
                type="number"
                min="1"
                max="10"
                value={form.question_count}
                onChange={(e) => update("question_count", Number(e.target.value))}
              />
            </label>
            <label>
              <span className="label">形式</span>
              <select className="field mt-1" value={form.format} onChange={(e) => update("format", e.target.value)}>
                <option value="multiple_choice">選択式</option>
                <option value="written">記述式</option>
                <option value="fill_blank">穴埋め</option>
                <option value="true_false">正誤判定</option>
              </select>
            </label>
            <label>
              <span className="label">出題ねらい</span>
              <select className="field mt-1" value={form.question_style} onChange={(e) => update("question_style", e.target.value)}>
                <option value="standard">標準演習</option>
                <option value="exam">テスト対策</option>
                <option value="weakness">苦手克服</option>
                <option value="speed">短時間演習</option>
                <option value="concept">考え方重視</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <label>
              <span className="label">学習目的</span>
              <textarea
                className="field mt-1 min-h-20"
                placeholder="例: 文章題で式を立てる練習をしたい"
                value={form.purpose}
                onChange={(e) => update("purpose", e.target.value)}
              />
            </label>
            <label>
              <span className="label">重点ポイント</span>
              <input
                className="field mt-1"
                placeholder="例: 途中式、単位変換、ひっかけ"
                value={form.focus_points}
                onChange={(e) => update("focus_points", e.target.value)}
              />
            </label>
            <label>
              <span className="label">避けたい内容</span>
              <input
                className="field mt-1"
                placeholder="例: 未習範囲、平方根、難しい公式"
                value={form.excluded_topics}
                onChange={(e) => update("excluded_topics", e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-2 rounded-md bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input checked={form.include_hints} type="checkbox" onChange={(e) => update("include_hints", e.target.checked)} />
              ヒントを付ける
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input checked={form.include_steps} type="checkbox" onChange={(e) => update("include_steps", e.target.checked)} />
              考え方・途中式を詳しくする
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                checked={form.include_similar_problem}
                type="checkbox"
                onChange={(e) => update("include_similar_problem", e.target.checked)}
              />
              類題も作る
            </label>
          </div>

          <div className="flex gap-3">
            <button className="btn-primary flex-1" disabled={busy} type="submit">
              {busy ? "生成中..." : "問題を生成"}
            </button>
            <button className="btn-secondary" type="button" onClick={loadSavedProblems}>
              保存済み
            </button>
          </div>
        </form>

        <section>
          <div className="panel mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">生成結果・解答</h2>
              <p className="text-sm text-slate-600">
                {problems.length
                  ? `${form.subject} / ${form.unit || "保存済み問題"} / ${difficultyLabels[form.difficulty] ?? ""} / ${
                      formatLabels[form.format] ?? ""
                    }`
                  : "問題を生成するか、保存済み問題を読み込んでください"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" disabled={!problems.length || busy} onClick={() => generate()} type="button">
                再生成
              </button>
              <button className="btn-primary" disabled={!problems.length} onClick={saveAll} type="button">
                保存
              </button>
            </div>
          </div>

          {message && <p className="notice">{message}</p>}

          {!problems.length && (
            <div className="panel mt-4">
              <h3 className="font-bold">使い方</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
                <li>左側で条件を入力して問題を生成します。</li>
                <li>選択肢を押すか、回答欄に答えを入力します。</li>
                <li>「分析へ記録」を押すと、正答率と苦手分析に反映されます。</li>
                <li>保存済み問題も読み込んで、あとから解き直せます。</li>
              </ol>
            </div>
          )}

          <div className="mt-5 grid gap-4">
            {problems.map((problem, index) => (
              <article className="panel" key={`${problem.id ?? problem.question}-${index}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-focus">
                      問題 {index + 1} / {problem.subject} / {problem.unit}
                    </p>
                    <h3 className="mt-2 text-lg font-bold leading-relaxed">{problem.question}</h3>
                  </div>
                  <button className="btn-secondary shrink-0" onClick={() => copyProblem(problem)} type="button">
                    コピー
                  </button>
                </div>

                {problem.choices && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {problem.choices.map((choice, choiceIndex) => (
                      <button
                        className={`rounded-md border p-3 text-left transition ${
                          answers[index] === choice ? "border-focus bg-blue-50 text-focus" : "border-slate-200 bg-slate-50 hover:border-focus"
                        }`}
                        key={`${choice}-${choiceIndex}`}
                        onClick={() => setAnswers((current) => ({ ...current, [index]: choice }))}
                        type="button"
                      >
                        <span className="font-semibold">{choiceIndex + 1}.</span> {choice}
                      </button>
                    ))}
                  </div>
                )}

                {problem.hint && (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <span className="font-bold">ヒント: </span>
                    {problem.hint}
                  </div>
                )}

                <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <label>
                    <span className="label">あなたの回答</span>
                    <input
                      className="field mt-1"
                      placeholder="ここに答えを入力"
                      value={answers[index] ?? ""}
                      onChange={(e) => setAnswers((current) => ({ ...current, [index]: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="label">間違えた場合の理由</span>
                    <select
                      className="field mt-1"
                      value={mistakes[index] ?? ""}
                      onChange={(e) => setMistakes((current) => ({ ...current, [index]: e.target.value }))}
                    >
                      <option value="">未分類</option>
                      {mistakeTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" onClick={() => submitAnswer(index)} type="button">
                      分析へ記録
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => setOpenAnswer((current) => ({ ...current, [index]: !current[index] }))}
                    >
                      {openAnswer[index] ? "答えを隠す" : "答えを見る"}
                    </button>
                  </div>
                  {index in results && (
                    <p className={`text-sm font-bold ${results[index] ? "text-emerald-700" : "text-rose-700"}`}>
                      {results[index] ? "正解として記録済みです" : "不正解として記録済みです"}
                    </p>
                  )}
                </div>

                {openAnswer[index] && (
                  <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-bold text-emerald-800">答え: {problem.answer}</p>
                    <p className="mt-2 text-slate-700">{problem.explanation}</p>
                    {stepsToArray(problem.steps).length > 0 && (
                      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                        {stepsToArray(problem.steps).map((step, stepIndex) => (
                          <li key={`${step}-${stepIndex}`}>{step}</li>
                        ))}
                      </ol>
                    )}
                    {problem.similar_problem && (
                      <div className="mt-3 rounded-md bg-white p-3 text-sm">
                        <span className="font-bold">類題: </span>
                        {problem.similar_problem}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
