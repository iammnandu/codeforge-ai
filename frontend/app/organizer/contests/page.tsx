"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OrganizerShell } from "@/components/shells/OrganizerShell";
import { api } from "@/lib/api";
import { Plus, Trophy, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function OrganizerContestsPage() {
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/contests").then(({ data }) => { setContests(data); setLoading(false); });
  }, []);

  return (
    <OrganizerShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Contests</h1>
            <p className="text-gray-400 text-sm mt-1">All your coding contests</p>
          </div>
          <Link href="/organizer/contests/new"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> New Contest
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />)}
          </div>
        ) : contests.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No contests yet.</p>
            <Link href="/organizer/contests/new" className="text-violet-400 hover:text-violet-300 text-sm mt-2 inline-block">Create one →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {contests.map((c) => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 flex items-center justify-between transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className="font-semibold text-white">{c.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      c.is_published ? "bg-green-900/30 text-green-400 border-green-900/40" : "bg-gray-800 text-gray-500 border-gray-700"
                    }`}>{c.is_published ? "Published" : "Draft"}</span>
                    {c.proctoring_enabled && (
                      <span className="text-xs bg-violet-900/30 text-violet-400 border border-violet-900/40 px-2 py-0.5 rounded-full">🔒 Proctored</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(c.start_time), "d MMM yyyy")}</span>
                    <span>{c.duration_minutes} min</span>
                    <span className="font-mono bg-gray-800 px-2 py-0.5 rounded">{c.contest_code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/organizer/proctor/${c.id}`}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 bg-violet-900/30 hover:bg-violet-900/50 text-violet-400 rounded-lg transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Monitor
                  </Link>
                  <Link href={`/organizer/contests/${c.id}`}
                    className="text-xs px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OrganizerShell>
  );
}
