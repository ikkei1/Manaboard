"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { StudyForm, StudyInput } from "@/components/StudyForm";
import { apiFetch } from "@/lib/api";
type StudyLog = StudyInput & { id: string };
export default function EditStudyPage() {
  const router = useRouter(); const params = useParams<{ id: string }>(); const [log, setLog] = useState<StudyLog | null>(null); const [error, setError] = useState("");
  useEffect(() => { apiFetch<StudyLog>(`/study/${params.id}`).then(setLog).catch((e) => setError(e.message)); }, [params.id]);
  async function save(data: StudyInput) { await apiFetch(`/study/${params.id}`, { method: "PUT", body: JSON.stringify({ ...data, memo: data.memo || null }) }); router.push("/study"); }
  return <Shell><div className="mb-6"><h1 className="text-3xl font-bold">学習記録を編集</h1></div>{error && <p className="panel text-red-700">{error}</p>}{log ? <StudyForm initial={log} onSubmit={save} /> : !error && <p className="panel">読み込み中...</p>}</Shell>;
}
