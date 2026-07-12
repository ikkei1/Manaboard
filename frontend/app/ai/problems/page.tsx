"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
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
  include_hints: false,
  include_steps: true,
  include_similar_problem: false,
};

const examSections = [
  ["exam", "科目A"],
  ["concept", "科目B"],
];

const difficulties = [
  ["easy", "基礎"],
  ["normal", "標準"],
  ["hard", "応用"],
];

function cleanGeneratedText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&lt;\/?u(?:\s[^&]*)?&gt;/gi, "")
    .replace(/<\/?u(?:\s[^>]*)?>/gi, "")
    .replace(/&lt;[^&]+&gt;/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function cleanSteps(steps: Problem["steps"]) {
  if (!steps) return null;
  if (Array.isArray(steps)) return steps.map(cleanGeneratedText).filter(Boolean);
  return cleanGeneratedText(steps);
}

function cleanProblem(problem: Problem): Problem {
  return {
    ...problem,
    question: cleanGeneratedText(problem.question),
    choices: problem.choices?.map(cleanGeneratedText).filter(Boolean) ?? null,
    answer: cleanGeneratedText(problem.answer),
    explanation: cleanGeneratedText(problem.explanation),
    steps: cleanSteps(problem.steps),
    similar_problem: problem.similar_problem ? cleanGeneratedText(problem.similar_problem) : null,
  };
}

function stepsToArray(steps: Problem["steps"]) {
  if (!steps) return [];
  return Array.isArray(steps) ? steps : [steps];
}

function normalizeAnswer(value: string) {
  return cleanGeneratedText(value).replace(/\s/g, "").replace(/[（）]/g, (s) => (s === "（" ? "(" : ")")).toLowerCase();
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
  const clean = cleanProblem(problem);
  return {
    subject: clean.subject,
    unit: clean.unit,
    difficulty: clean.difficulty,
    format: clean.format,
    question: clean.question,
    choices: clean.choices,
    answer: clean.answer,
    explanation: clean.explanation,
  };
}

export default function Page() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [openAnswer, setOpenAnswer] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, boolean>>({});

  const currentProblem = problems[currentIndex] ?? null;
  const answeredCount = useMemo(() => Object.keys(results).length, [results]);
  const answeredPercent = problems.length ? Math.round((answeredCount / problems.length) * 100) : 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSubject(subject: string) {
    setForm((current) => ({ ...current, subject, unit: themePresets[subject][0] }));
  }

  function updateExamSection(questionStyle: string) {
    setForm((current) => ({
      ...current,
      question_style: questionStyle,
      format: questionStyle === "concept" ? "written" : "multiple_choice",
    }));
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
      setProblems(response.problems.map(cleanProblem));
      setCurrentIndex(0);
      setOpenAnswer({});
      setAnswers({});
      setResults({});
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
    if (!userAnswer) return;
    setMessage("");
    setBusy(true);
    try {
      const problemId = await ensureSaved(index);
      const isCorrect = isCorrectAnswer(userAnswer, problem);
      await apiFetch(`/problems/${problemId}/answer`, {
        method: "POST",
        body: JSON.stringify({ user_answer: userAnswer, is_correct: isCorrect, mistake_type: isCorrect ? null : "不正解" }),
      });
      setResults((current) => ({ ...current, [index]: isCorrect }));
      setOpenAnswer((current) => ({ ...current, [index]: true }));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function moveQuestion(direction: -1 | 1) {
    setCurrentIndex((current) => Math.min(Math.max(current + direction, 0), problems.length - 1));
  }

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-ink">AI問題</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <form className="panel grid content-start gap-4" onSubmit={generate}>
          <h2 className="section-title mb-0 inline-flex items-center gap-2">
            <Icon name="spark" size={20} />
            作成
          </h2>

          <button className="action-primary gap-2" disabled={busy}>
            <Icon name="spark" size={22} />
            {busy ? "生成中..." : "生成"}
          </button>

          <ToggleGroup columns="grid-cols-2" label="科目" value={form.question_style} items={examSections} onChange={updateExamSection} />

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
        </form>

        <section className="grid content-start gap-4">
          {!currentProblem && <ProblemPlaceholder />}

          {currentProblem && (
            <article className="panel min-h-[520px]">
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-600">
                  <span>{answeredPercent}%</span>
                  <span>{currentIndex + 1}/{problems.length}</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-focus transition-all" style={{ width: `${answeredPercent}%` }} />
                </div>
              </div>

              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-focus">
                  <Icon name="problems" size={17} />
                  問題 {currentIndex + 1}
                </p>
                <h2 className="mt-3 text-xl font-bold leading-relaxed">{currentProblem.question}</h2>
              </div>

              {currentProblem.choices && (
                <div className="mt-5 grid gap-2">
                  {currentProblem.choices.map((choice, choiceIndex) => {
                    const value = String(choiceIndex + 1);
                    return (
                      <button
                        className={`rounded-md border p-4 text-left transition ${
                          answers[currentIndex] === value ? "border-focus bg-blue-50 text-focus" : "border-slate-200 bg-slate-50 hover:border-focus"
                        }`}
                        key={`${choice}-${choiceIndex}`}
                        onClick={() => setAnswers((current) => ({ ...current, [currentIndex]: value }))}
                        type="button"
                      >
                        <span className="font-semibold">{choiceIndex + 1}.</span> {choice}
                      </button>
                    );
                  })}
                </div>
              )}

              {!currentProblem.choices && (
                <input
                  className="field mt-5"
                  placeholder="回答"
                  value={answers[currentIndex] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [currentIndex]: event.target.value }))}
                />
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <button className="action-primary gap-2" disabled={!answers[currentIndex]?.trim() || busy} onClick={() => submitAnswer(currentIndex)} type="button">
                  <Icon name="check" size={18} />
                  採点
                </button>
                <button className="btn-secondary" disabled={currentIndex <= 0} onClick={() => moveQuestion(-1)} type="button">
                  前へ
                </button>
                <button className="btn-secondary" disabled={currentIndex >= problems.length - 1} onClick={() => moveQuestion(1)} type="button">
                  次へ
                </button>
              </div>

            </article>
          )}
        </section>
      </div>

      {currentProblem && openAnswer[currentIndex] && (
        <section aria-label="解答表示領域" className="panel mt-5 h-[320px] overflow-y-auto">
          <h2 className="section-title inline-flex items-center gap-2">
            <Icon name="check" size={20} />
            解答
          </h2>
          <div>
            {currentIndex in results && (
              <p className={`mb-3 text-sm font-bold ${results[currentIndex] ? "text-emerald-700" : "text-rose-700"}`}>
                {results[currentIndex] ? "正解" : "不正解"}
              </p>
            )}
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-bold text-emerald-800">答え: {currentProblem.answer}</p>
              <p className="mt-2 text-slate-700">{currentProblem.explanation}</p>
              {stepsToArray(currentProblem.steps).length > 0 && (
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                  {stepsToArray(currentProblem.steps).map((step, stepIndex) => (
                    <li key={`${step}-${stepIndex}`}>{step}</li>
                  ))}
                </ol>
              )}
              {currentProblem.similar_problem && (
                <div className="mt-3 rounded-md bg-white p-3 text-sm">
                  <b>類題: </b>
                  {currentProblem.similar_problem}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {message && <p className="notice">{message}</p>}

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Whiteboard />
        <Calculator />
      </section>
    </Shell>
  );
}

function ProblemPlaceholder() {
  return (
    <article aria-label="問題表示領域" className="panel min-h-[520px]">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-400">
          <span>0%</span>
          <span>0/3</span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-100" />
      </div>

      <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400">
        <Icon name="problems" size={17} />
        問題
      </p>
      <div className="mt-4 h-7 w-4/5 rounded-md bg-slate-100" />
      <div className="mt-3 h-7 w-3/5 rounded-md bg-slate-100" />

      <div className="mt-8 grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-14 rounded-md border border-slate-200 bg-slate-50" key={index} />
        ))}
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <button className="action-primary" disabled type="button">採点</button>
        <button className="btn-secondary" disabled type="button">前へ</button>
        <button className="btn-secondary" disabled type="button">次へ</button>
      </div>
    </article>
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

function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const context = canvas.getContext("2d");
    context?.scale(ratio, ratio);
    if (context) {
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 3;
      context.strokeStyle = "#18202f";
    }
  }, []);

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = point(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(next.x, next.y);
  }

  function draw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className="panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-title mb-0 inline-flex items-center gap-2">
          <Icon name="pen" size={20} />
          ホワイトボード
        </h2>
        <button aria-label="ホワイトボードを消去" className="btn-secondary h-11 w-11 px-0" onClick={clear} title="消去" type="button">
          <Icon name="x" size={20} />
        </button>
      </div>
      <canvas
        className="h-[360px] w-full touch-none rounded-md border border-slate-200 bg-white"
        onPointerCancel={() => (drawingRef.current = false)}
        onPointerDown={startDrawing}
        onPointerLeave={() => (drawingRef.current = false)}
        onPointerMove={draw}
        onPointerUp={() => (drawingRef.current = false)}
        ref={canvasRef}
      />
    </div>
  );
}

type CalculatorOperator = "+" | "−" | "×" | "÷";

function Calculator() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<CalculatorOperator | null>(null);
  const [waiting, setWaiting] = useState(false);

  function calculate(left: number, right: number, nextOperator: CalculatorOperator) {
    if (nextOperator === "+") return left + right;
    if (nextOperator === "−") return left - right;
    if (nextOperator === "×") return left * right;
    return right === 0 ? 0 : left / right;
  }

  function input(value: string) {
    if (waiting) {
      setDisplay(value);
      setWaiting(false);
      return;
    }
    setDisplay((current) => (current === "0" ? value : `${current}${value}`).slice(0, 14));
  }

  function decimal() {
    if (waiting) {
      setDisplay("0.");
      setWaiting(false);
      return;
    }
    if (!display.includes(".")) setDisplay(`${display}.`);
  }

  function choose(nextOperator: CalculatorOperator) {
    const value = Number(display);
    if (stored !== null && operator && !waiting) {
      const result = calculate(stored, value, operator);
      setStored(result);
      setDisplay(String(result).slice(0, 14));
    } else {
      setStored(value);
    }
    setOperator(nextOperator);
    setWaiting(true);
  }

  function equals() {
    if (stored === null || !operator) return;
    const result = calculate(stored, Number(display), operator);
    setDisplay(String(result).slice(0, 14));
    setStored(null);
    setOperator(null);
    setWaiting(true);
  }

  function clear() {
    setDisplay("0");
    setStored(null);
    setOperator(null);
    setWaiting(false);
  }

  const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−"];

  return (
    <div className="panel h-fit">
      <h2 className="section-title inline-flex items-center gap-2">
        <Icon name="calculator" size={20} />
        計算機
      </h2>
      <div className="mb-3 overflow-hidden rounded-md bg-slate-950 px-4 py-5 text-right font-mono text-3xl font-bold text-white">{display}</div>
      <div className="grid grid-cols-4 gap-2">
        <button className="calculator-key col-span-2" onClick={clear} type="button">C</button>
        <button className="calculator-key" onClick={() => setDisplay(String(Number(display) * -1))} type="button">±</button>
        <button className="calculator-key" onClick={() => setDisplay(String(Number(display) / 100))} type="button">%</button>
        {keys.map((key) => (
          <button
            className={`calculator-key ${["÷", "×", "−"].includes(key) ? "bg-blue-50 text-focus" : ""}`}
            key={key}
            onClick={() => (["÷", "×", "−"].includes(key) ? choose(key as CalculatorOperator) : input(key))}
            type="button"
          >
            {key}
          </button>
        ))}
        <button className="calculator-key col-span-2" onClick={() => input("0")} type="button">0</button>
        <button className="calculator-key" onClick={decimal} type="button">.</button>
        <button className="calculator-key bg-focus text-white" onClick={() => choose("+")} type="button">+</button>
        <button className="action-primary col-span-4 min-h-12" onClick={equals} type="button">=</button>
      </div>
    </div>
  );
}
