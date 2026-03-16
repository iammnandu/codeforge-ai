"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { CandidateShell } from "@/components/shells/CandidateShell";

const DIFFICULTIES = ["all", "easy", "medium", "hard"];

export default function PracticePage() {
  const [problems, setProblems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/problems").then(({ data }) => {
      setProblems(data);
      setFiltered(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let result = problems;
    if (difficulty !== "all") result = result.filter((p) => p.difficulty === difficulty);
    if (search) result = result.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
    setFiltered(result);
  }, [search, difficulty, problems]);

  const difficultyColor = (d: string) =>
    d === "easy" ? "bg-green-900/40 text-green-400 border-green-900/40" :
    d === "medium" ? "bg-yellow-900/40 text-yellow-400 border-yellow-900/40" :
    "bg-red-900/40 text-red-400 border-red-900/40";

  return (
    <CandidateShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Practice Problems</h1>
          <p className="text-gray-400 text-sm mt-1">{problems.length} problems available</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problems…"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all capitalize ${
                  difficulty === d
                    ? "border-violet-500 bg-violet-950/40 text-violet-300"
                    : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                }`}>{d}</button>
            ))}
          </div>
        </div>

        {/* Problem table */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-800 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span className="col-span-1">#</span>
              <span className="col-span-6">Title</span>
              <span className="col-span-2">Difficulty</span>
              <span className="col-span-3">Tags</span>
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No problems match your filters</p>
              </div>
            ) : (
              filtered.map((p, i) => (
                <Link key={p.id} href={`/candidate/ide/${p.id}`}
                  className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors group items-center">
                  <span className="col-span-1 text-sm text-gray-500">{i + 1}</span>
                  <span className="col-span-6 text-sm font-medium text-white group-hover:text-violet-300 transition-colors">{p.title}</span>
                  <span className="col-span-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${difficultyColor(p.difficulty)}`}>
                      {p.difficulty}
                    </span>
                  </span>
                  <span className="col-span-3 flex flex-wrap gap-1">
                    {(p.tags || []).slice(0, 2).map((tag: string, j: number) => (
                      <span key={j} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md">{tag}</span>
                    ))}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </CandidateShell>
  );
}
