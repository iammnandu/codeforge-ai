"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CandidateShell } from "@/components/shells/CandidateShell";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Clock } from "lucide-react";
import toast from "react-hot-toast";

export default function CandidateContestResultPage() {
  const { contestId } = useParams();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadResults = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const { data } = await api.get(`/contests/${contestId}/results`, {
        headers: { "Cache-Control": "no-cache" },
      });
      setRows(data || []);
    } catch (error: any) {
      if (error?.response?.status === 403) {
        toast.error("Results will be available only after contest ends");
        router.push("/candidate/dashboard");
      }
    } finally {
      if (!silent) setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults(true);
    const interval = setInterval(() => loadResults(true), 5000);
    return () => clearInterval(interval);
  }, [contestId, router]);

  if (loading) {
    return (
      <CandidateShell>
        <div className="h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </CandidateShell>
    );
  }

  const myRow = rows.find((row: any) => row.user_id === userId);

  return (
    <CandidateShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Contest Results</h1>
            <p className="text-gray-400 text-sm mt-1">Final ranking of all members</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadResults(false)}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-gray-300 rounded-lg text-sm transition-colors"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <Link href="/candidate/dashboard" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
              Dashboard
            </Link>
          </div>
        </div>

        {myRow && (myRow.malpractice_failed || myRow.malpractice_flagged) && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            myRow.malpractice_failed
              ? "bg-red-900/20 border-red-900/40 text-red-300"
              : "bg-yellow-900/20 border-yellow-900/40 text-yellow-300"
          }`}>
            {myRow.malpractice_failed ? "Malpractice failed" : "Malpractice flagged"}
            {myRow.malpractice_reason ? `: ${myRow.malpractice_reason}` : " during this contest."}
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider font-medium">
            <span>Rank</span>
            <span>Member</span>
            <span>Score</span>
            <span>Solved</span>
            <span>Joined</span>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No result rows found.</p>
          ) : (
            <div>
              {rows.map((row: any) => (
                <div key={row.user_id} className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-gray-800 last:border-0 text-sm">
                  <span className="text-yellow-400 font-semibold">#{row.rank ?? "-"}</span>
                  <span className="text-gray-300">{row.username || `User #${row.user_id}`}</span>
                  <span className="text-white font-semibold">{Math.round(row.score || 0)}</span>
                  <span className="text-green-400">{row.solved || 0}</span>
                  <span className="text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {row.joined_at ? new Date(row.joined_at).toLocaleString() : "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CandidateShell>
  );
}
