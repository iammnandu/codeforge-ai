"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OrganizerShell } from "@/components/shells/OrganizerShell";
import { api } from "@/lib/api";
import { Plus, Code2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function OrganizerProblemsPage() {
  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const tableGridClass = "grid grid-cols-[minmax(260px,3fr)_minmax(190px,2fr)_minmax(200px,2fr)_340px] gap-4 px-5";

  useEffect(() => {
    api.get("/problems?include_private=true").then(({ data }) => { setProblems(data); setLoading(false); });
  }, []);

  const toggleVisibility = async (problemId: number, nextPublic: boolean) => {
    try {
      await api.put(`/problems/${problemId}/visibility?is_public=${nextPublic}`);
      setProblems((prev) => prev.map((p) => p.id === problemId ? { ...p, is_public: nextPublic } : p));
      toast.success(nextPublic ? "Problem moved to Public practice" : "Problem set to Contest-only");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to update visibility");
    }
  };

  const deleteProblem = async (problemId: number, title: string) => {
    const ok = window.confirm(`Delete problem \"${title}\"? This cannot be undone.`);
    if (!ok) return;
    setDeletingId(problemId);
    try {
      await api.delete(`/problems/${problemId}`);
      setProblems((prev) => prev.filter((problem) => problem.id !== problemId));
      toast.success("Problem deleted");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to delete problem");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <OrganizerShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Problems</h1>
            <p className="text-gray-400 text-sm mt-1">Your problem bank</p>
          </div>
          <Link href="/organizer/problems/new"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> New Problem
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />)}
          </div>
        ) : problems.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Code2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No problems yet.</p>
            <Link href="/organizer/problems/new" className="text-violet-400 hover:text-violet-300 text-sm mt-2 inline-block">Create your first problem →</Link>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto">
            <div className="min-w-[1080px]">
              <div className={`${tableGridClass} py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider font-medium`}>
                <span>Title</span>
                <span>Difficulty</span>
                <span>Tags</span>
                <span className="text-right">Actions</span>
              </div>
              {problems.map((p) => (
              <div key={p.id} className={`${tableGridClass} py-4 border-b border-gray-800 last:border-0 items-start`}>
                <span className="min-w-0 text-white font-medium text-sm truncate">{p.title}</span>
                <span className="min-w-0">
                  <div className="flex gap-1.5 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full capitalize font-medium ${
                      p.difficulty === "easy" ? "bg-green-900/30 text-green-400" :
                      p.difficulty === "medium" ? "bg-yellow-900/30 text-yellow-400" : "bg-red-900/30 text-red-400"
                    }`}>{p.difficulty}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      p.is_public ? "bg-blue-900/30 text-blue-300" : "bg-gray-800 text-gray-400"
                    }`}>{p.is_public ? "Public" : "Contest"}</span>
                  </div>
                </span>
                <span className="min-w-0">
                  <span className="flex gap-1 flex-wrap max-w-full">
                    {(p.tags || []).slice(0, 3).map((tag: string) => (
                      <span key={tag} className="max-w-[120px] truncate text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{tag}</span>
                    ))}
                  </span>
                </span>
                <span className="flex justify-end gap-2 flex-nowrap shrink-0">
                  <button
                    onClick={() => toggleVisibility(p.id, !p.is_public)}
                    className="text-xs text-gray-300 hover:text-white px-3 py-1.5 bg-gray-800 rounded-lg transition-colors"
                  >
                    {p.is_public ? "Make Contest" : "Make Public"}
                  </button>
                  <Link href={`/candidate/ide/${p.id}`} target="_blank"
                    className="text-xs text-gray-400 hover:text-white px-3 py-1.5 bg-gray-800 rounded-lg transition-colors">Preview</Link>
                  <Link href={`/organizer/problems/${p.id}`}
                    className="text-xs text-gray-400 hover:text-white px-3 py-1.5 bg-gray-800 rounded-lg transition-colors">Edit</Link>
                  <button
                    onClick={() => deleteProblem(p.id, p.title)}
                    disabled={deletingId === p.id}
                    className="text-xs text-red-300 hover:text-red-200 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingId === p.id ? "Deleting..." : "Delete"}
                  </button>
                </span>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </OrganizerShell>
  );
}
