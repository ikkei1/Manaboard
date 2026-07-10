"use client";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { StudyForm, StudyInput } from "@/components/StudyForm";
import { apiFetch } from "@/lib/api";
export default function NewStudyPage() {
  const router = useRouter();
  async function save(data: StudyInput) { await apiFetch("/study", { method: "POST", body: JSON.stringify({ ...data, memo: data.memo || null }) }); router.push("/study"); }
  return <Shell><div className="mb-6"><h1 className="text-3xl font-bold">学習記録を追加</h1></div><StudyForm onSubmit={save} /></Shell>;
}
