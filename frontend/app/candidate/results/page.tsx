"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CandidateShell } from "@/components/shells/CandidateShell";
import { api } from "@/lib/api";
import { Trophy, BarChart3 } from "lucide-react";

export default function CandidateResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadResults = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const { data } = await api.get("/contests/results/my", {
        headers: { "Cache-Control": "no-cache" },
      });
      setResults(data || []);
    } finally {
      if (!silent) setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults(true);
    const interval = setInterval(() => loadResults(true), 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <CandidateShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Results</h1>
          <p className="text-gray-400 text-sm mt-1">Ended contests and your rankings</p>
        </div>
        <button
          onClick={() => loadResults(false)}
          disabled={refreshing}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-gray-300 rounded-lg text-sm transition-colors"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No results available yet.</p>
            <p className="text-xs mt-1">Results appear after contest time ends or organizer ends the contest.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider font-medium">
              <span>Contest</span>
              <span>Rank</span>
              <span>Score</span>
              <span className="text-right">Action</span>
            </div>
            {results.map((row) => (
              <div key={row.contest_id} className="grid grid-cols-4 gap-4 px-5 py-4 border-b border-gray-800 last:border-0 items-center">
                <div className="flex items-center gap-2 text-white font-medium">
                  <Trophy className="w-4 h-4 text-violet-400" />
                  <span>{row.title}</span>
                </div>
                <span className="text-yellow-400 font-semibold">{row.rank ? `#${row.rank}` : "-"}</span>
                <span className="text-white font-semibold">{Math.round(row.score || 0)}</span>
                <div className="text-right">
                  <Link href={`/candidate/contest/${row.contest_id}/results`}
                    className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CandidateShell>
  );
}
