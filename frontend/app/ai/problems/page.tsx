"use client";

import { FormEvent, useState } from "react";
import { Icon } from "@/components/Icon";
import { Shell } from "@/components/Shell";
import { apiFetch, subjects, themePresets } from "@/lib/api";

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
  format: string;
  question_style: string;
  include_hints: boolean;
  include_steps: boolean;
  include_similar_problem: boolean;
};

const initialForm: FormState = {
  subject: "テクノロジ系",
  unit: themePresets["テクノロジ系"][0],
  difficulty: "normal",
  format: "multiple_choice",
  question_style: "exam",
  include_hints: true,
  include_steps: true,
  include_similar_problem: false,
};

const styles = [
  ["exam", "科目A"],
  ["concept", "科目B"],
  ["weakness", "苦手"],
  ["speed", "暗記"],
];

const difficulties = [
  ["easy", "基礎"],
  ["normal", "標準"],
  ["hard", "応用"],
];

const formats = [
  ["multiple_choice", "選択"],
  ["written", "記述"],
  ["fill_blank", "穴埋め"],
  ["true_false", "正誤"],
];

function stepsToArray(steps: Problem["steps"]) {
  if (!steps) return [];
  return Array.isArray(steps) ? steps : [steps];
}

function normalizeAnswer(value: string) {
  return value.replace(/\s/g, "").replace(/[（）]/g, (s) => (s === "（" ? "(" : ")")).toLowerCase();
}

function isCorrectAnswer(userAnswer: string, problem: Problem) {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedAnswer = normalizeAnswer(problem.answer);
  if (normalizedUser === normalizedAnswer) return true;

  const selectedIndex = Number(userAnswer) - 1;
  const selectedChoice = problem.choices?.[selectedIndex];
  if (!selectedChoice) return false;

  const accepted = [
    String(selectedIndex + 1),
    `${selectedIndex + 1}.`,
    `(${selectedIndex + 1})`,
    String.fromCharCode(97 + selectedIndex),
    String.fromCharCode(65 + selectedIndex),
    selectedChoice,
    `${selectedIndex + 1}.${selectedChoice}`,
    `(${selectedIndex + 1})${selectedChoice}`,
  ].map(normalizeAnswer);

  return accepted.includes(normalizedAnswer);
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
  const [results, setResults] = useState<Record<number, boolean>>({});

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSubject(subject: string) {
    setForm((current) => ({ ...current, subject, unit: themePresets[subject][0] }));
  }

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await apiFetch<{ problems: Problem[] }>("/ai/problems/generate", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          question_count: 3,
          purpose: null,
          focus_points: null,
          excluded_topics: null,
        }),
      });
      setProblems(response.problems);
      setOpenAnswer({});
      setAnswers({});
      setResults({});
      setMessage("3問生成しました");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
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
      setMessage("回答を選択または入力してください");
      return;
    }
    const problemId = await ensureSaved(index);
    const isCorrect = isCorrectAnswer(userAnswer, problem);
    await apiFetch(`/problems/${problemId}/answer`, {
      method: "POST",
      body: JSON.stringify({ user_answer: userAnswer, is_correct: isCorrect, mistake_type: isCorrect ? null : "復習対象" }),
    });
    setResults((current) => ({ ...current, [index]: isCorrect }));
    setOpenAnswer((current) => ({ ...current, [index]: true }));
    setMessage(isCorrect ? "正解として保存しました" : "復習対象として保存しました");
  }

  async function saveAll() {
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
    setMessage("保存しました");
  }

  async function loadSavedProblems() {
    const saved = await apiFetch<Problem[]>("/ai/problems");
    setProblems(saved);
    setOpenAnswer({});
    setAnswers({});
    setResults({});
    setMessage(saved.length ? "保存済み問題を読み込みました" : "保存済み問題はありません");
  }

  async function copyProblem(problem: Problem) {
    const choices = problem.choices?.map((choice, index) => `${index + 1}. ${choice}`).join("\n") ?? "";
    await navigator.clipboard.writeText([`問題: ${problem.question}`, choices, `答え: ${problem.answer}`, `解説: ${problem.explanation}`].filter(Boolean).join("\n\n"));
    setMessage("コピーしました");
  }

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink">AI問題</h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 font-bold text-blue-950">
            <Icon name="spark" size={19} />
            3問固定
          </div>
        </div>
        <button className="btn-secondary gap-2" disabled={busy} onClick={loadSavedProblems} type="button">
          <Icon name="list" size={18} />
          保存済み
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <form className="panel grid content-start gap-4" onSubmit={generate}>
          <h2 className="section-title mb-0 inline-flex items-center gap-2">
            <Icon name="spark" size={20} />
            作成
          </h2>

          <label className="block">
            <span className="label">分野</span>
            <select className="field mt-1" value={form.subject} onChange={(event) => updateSubject(event.target.value)}>
              {subjects.map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">テーマ</span>
            <select className="field mt-1" value={form.unit} onChange={(event) => update("unit", event.target.value)}>
              {themePresets[form.subject].map((theme) => (
                <option key={theme}>{theme}</option>
              ))}
            </select>
          </label>

          <ToggleGroup columns="grid-cols-3" label="難易度" value={form.difficulty} items={difficulties} onChange={(value) => update("difficulty", value)} />

          <details>
            <summary className="btn-secondary cursor-pointer list-none gap-2">
              <Icon name="settings" size={18} />
              細かい設定
            </summary>
            <div className="mt-4 grid gap-4">
              <ToggleGroup columns="grid-cols-2" label="ねらい" value={form.question_style} items={styles} onChange={(value) => update("question_style", value)} />
              <ToggleGroup columns="grid-cols-2" label="形式" value={form.format} items={formats} onChange={(value) => update("format", value)} />
              <div className="grid grid-cols-3 gap-2">
                <ToggleButton active={form.include_hints} onClick={() => update("include_hints", !form.include_hints)}>
                  ヒント
                </ToggleButton>
                <ToggleButton active={form.include_steps} onClick={() => update("include_steps", !form.include_steps)}>
                  手順
                </ToggleButton>
                <ToggleButton active={form.include_similar_problem} onClick={() => update("include_similar_problem", !form.include_similar_problem)}>
                  類題
                </ToggleButton>
              </div>
            </div>
          </details>

          <button className="action-primary gap-2" disabled={busy}>
            <Icon name="plus" size={22} />
            {busy ? "生成中..." : "生成"}
          </button>
        </form>

        <section className="grid content-start gap-4">
          <div className="panel flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">{form.subject}</p>
              <h2 className="truncate text-lg font-bold">{form.unit}</h2>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary gap-2" disabled={!problems.length || busy} onClick={() => generate()} type="button">
                <Icon name="spark" size={18} />
                再生成
              </button>
              <button className="btn-primary gap-2" disabled={!problems.length} onClick={saveAll} type="button">
                <Icon name="check" size={18} />
                保存
              </button>
            </div>
          </div>

          {message && <p className="notice">{message}</p>}
          {!problems.length && (
            <div className="panel grid min-h-72 place-items-center text-center">
              <div>
                <Icon className="mx-auto text-slate-300" name="problems" size={54} />
                <p className="mt-3 text-xl font-bold text-slate-500">未生成</p>
              </div>
            </div>
          )}

          {problems.map((problem, index) => (
            <article className="panel" key={`${problem.id ?? problem.question}-${index}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-focus">
                    <Icon name="problems" size={17} />
                    問題 {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-bold leading-relaxed">{problem.question}</h3>
                </div>
                <button className="btn-secondary shrink-0 gap-2" onClick={() => copyProblem(problem)} type="button">
                  <Icon name="list" size={17} />
                  コピー
                </button>
              </div>

              {problem.choices && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {problem.choices.map((choice, choiceIndex) => {
                    const value = String(choiceIndex + 1);
                    return (
                      <button
                        className={`rounded-md border p-3 text-left transition ${
                          answers[index] === value ? "border-focus bg-blue-50 text-focus" : "border-slate-200 bg-slate-50 hover:border-focus"
                        }`}
                        key={`${choice}-${choiceIndex}`}
                        onClick={() => setAnswers((current) => ({ ...current, [index]: value }))}
                        type="button"
                      >
                        <span className="font-semibold">{choiceIndex + 1}.</span> {choice}
                      </button>
                    );
                  })}
                </div>
              )}

              {!problem.choices && (
                <input
                  className="field mt-4"
                  placeholder="回答"
                  value={answers[index] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [index]: event.target.value }))}
                />
              )}

              {problem.hint && (
                <details className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <summary className="cursor-pointer list-none font-bold">ヒント</summary>
                  <p className="mt-2">{problem.hint}</p>
                </details>
              )}

              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                <button className="btn-primary gap-2" disabled={!answers[index]?.trim()} onClick={() => submitAnswer(index)} type="button">
                  <Icon name="check" size={18} />
                  採点
                </button>
                <button className="btn-secondary gap-2" type="button" onClick={() => setOpenAnswer((current) => ({ ...current, [index]: !current[index] }))}>
                  <Icon name="book" size={18} />
                  {openAnswer[index] ? "閉じる" : "解説"}
                </button>
              </div>

              {index in results && (
                <p className={`mt-3 text-sm font-bold ${results[index] ? "text-emerald-700" : "text-rose-700"}`}>
                  {results[index] ? "正解" : "復習対象"}
                </p>
              )}

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
                      <b>類題: </b>{problem.similar_problem}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </Shell>
  );
}

function ToggleGroup({
  columns,
  label,
  value,
  items,
  onChange,
}: {
  columns: string;
  label: string;
  value: string;
  items: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className={`mt-2 grid gap-2 ${columns}`}>
        {items.map(([itemValue, itemLabel]) => (
          <ToggleButton active={value === itemValue} key={itemValue} onClick={() => onChange(itemValue)}>
            {itemLabel}
          </ToggleButton>
        ))}
      </div>
    </div>
  );
}

function ToggleButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className={`segment-button ${active ? "segment-on" : "segment-off"}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}
