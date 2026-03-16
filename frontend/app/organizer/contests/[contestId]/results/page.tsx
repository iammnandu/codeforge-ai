"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { OrganizerShell } from "@/components/shells/OrganizerShell";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

export default function OrganizerContestResultsPage() {
  const { contestId } = useParams();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadResults = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/contests/${contestId}/results`);
      setRows(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  const endContest = async () => {
    try {
      await api.put(`/contests/${contestId}/end`);
      toast.success("Contest ended and results finalized");
      loadResults();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to end contest");
    }
  };

  useEffect(() => {
    loadResults();
  }, [contestId]);

  return (
    <OrganizerShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Contest Results</h1>
            <p className="text-sm text-gray-400 mt-1">Final ranking and marks table</p>
          </div>
          <button
            onClick={endContest}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            End Contest Now
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider font-medium">
            <span>Rank</span>
            <span>User</span>
            <span>Score</span>
            <span>Solved</span>
            <span>Manual Mark</span>
            <span className="text-right">Details</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading results…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">No participants yet.</div>
          ) : (
            rows.map((row) => (
              <ResultRow key={row.user_id} row={row} contestId={contestId as string} onDone={loadResults} />
            ))
          )}
        </div>
      </div>
    </OrganizerShell>
  );
}

function ResultRow({ row, contestId, onDone }: { row: any; contestId: string; onDone: () => void }) {
  const [score, setScore] = useState("");
  const [saving, setSaving] = useState(false);

  const applyMark = async () => {
    const parsed = Number(score);
    if (Number.isNaN(parsed)) {
      toast.error("Enter valid mark (0-100)");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/contests/${contestId}/results/mark?user_id=${row.user_id}&marks=${parsed}`);
      toast.success("Manual mark applied");
      onDone();
      setScore("");
    } catch {
      toast.error("Could not apply mark for this row");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-gray-800 last:border-0 text-sm items-center">
      <span className="text-yellow-400 font-semibold">#{row.rank}</span>
      <span className="text-gray-300">{row.username || `User #${row.user_id}`}</span>
      <span className="text-white font-semibold">{Math.round(row.score || 0)}</span>
      <span className="text-green-400">{row.solved || 0}</span>
      <div className="flex gap-2">
        <input
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="0-100"
          className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white"
        />
        <button
          onClick={applyMark}
          disabled={saving}
          className="px-2 py-1 text-xs bg-violet-600 hover:bg-violet-500 rounded-lg text-white disabled:opacity-60"
        >
          Mark
        </button>
      </div>
      <div className="text-right">
        <Link
          href={`/organizer/contests/${contestId}/candidates/${row.user_id}`}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          View →
        </Link>
      </div>
    </div>
  );
}
