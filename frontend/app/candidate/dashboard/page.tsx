"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Code2, Trophy, BookOpen, ArrowRight, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { CandidateShell } from "@/components/shells/CandidateShell";
import { format } from "date-fns";

export default function CandidateDashboard() {
  const [contests, setContests] = useState<any[]>([]);
  const [problems, setProblems] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api.get("/contests").then(({ data }) => setContests(data));
    api.get("/problems").then(({ data }) => setProblems(data.slice(0, 6)));
    api.get("/contests/results/my").then(({ data }) => setResults(data)).catch(() => {});
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    try {
      const { data } = await api.post("/contests/join", { contest_code: joinCode.trim().toUpperCase() });
      window.location.href = `/candidate/contest/${data.contest_id}`;
    } catch {
      import("react-hot-toast").then(({ default: toast }) => toast.error("Invalid contest code"));
    } finally {
      setJoining(false);
    }
  };

  return (
    <CandidateShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Practice problems or join a live contest</p>
        </div>

        {/* Join by code */}
        <div className="bg-gradient-to-r from-violet-950/60 to-gray-900 border border-violet-800/30 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-1">Join a Contest</h2>
          <p className="text-sm text-gray-400 mb-4">Enter the 8-character code from your invite</p>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234" maxLength={8}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-lg tracking-widest focus:outline-none focus:border-violet-500 uppercase"
            />
            <button type="submit" disabled={joining || joinCode.length < 6}
              className="px-6 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">
              {joining ? "…" : "Join"}
            </button>
          </form>
        </div>

        {/* Active contests */}
        {contests.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" /> Open Contests
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {contests.map((c) => (
                <Link key={c.id} href={`/candidate/contest/${c.id}`}
                  className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors">{c.title}</h3>
                    {c.proctoring_enabled && (
                      <span className="text-xs bg-violet-900/40 text-violet-400 px-2 py-0.5 rounded-full">🔒 Proctored</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.duration_minutes} min</span>
                    <span>{format(new Date(c.start_time), "d MMM, HH:mm")}</span>
                  </div>
                  <div className="mt-3 text-xs text-violet-400 flex items-center gap-1">
                    Enter contest <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Practice problems */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" /> Practice Problems
            </h2>
            <Link href="/candidate/practice" className="text-sm text-violet-400 hover:text-violet-300">View all →</Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {problems.map((p) => (
              <Link key={p.id} href={`/candidate/ide/${p.id}`}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-white text-sm group-hover:text-violet-300 transition-colors line-clamp-1">{p.title}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.difficulty === "easy"   ? "bg-green-900/40 text-green-400"  :
                  p.difficulty === "medium" ? "bg-yellow-900/40 text-yellow-400" :
                  "bg-red-900/40 text-red-400"
                }`}>{p.difficulty}</span>
              </Link>
            ))}
          </div>
        </div>

        {results.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-violet-400" /> Submitted Contest Results
              </h2>
              <Link href="/candidate/results" className="text-sm text-violet-400 hover:text-violet-300">View all →</Link>
            </div>
            <div className="space-y-3">
              {results.map((row) => (
                <Link
                  key={row.contest_id}
                  href={`/candidate/contest/${row.contest_id}/results`}
                  className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-colors"
                >
                  <div>
                    <p className="text-white font-medium">{row.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Rank: {row.rank ? `#${row.rank}` : "-"} • Score: {Math.round(row.score || 0)}
                    </p>
                  </div>
                  <span className="text-xs text-violet-400">View Result →</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </CandidateShell>
  );
}
