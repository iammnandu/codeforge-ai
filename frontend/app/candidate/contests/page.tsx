"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Clock, Lock, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { CandidateShell } from "@/components/shells/CandidateShell";
import { format, isPast, isFuture } from "date-fns";

export default function CandidateContestsPage() {
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/contests").then(({ data }) => { setContests(data); setLoading(false); });
  }, []);

  const getStatus = (c: any) => {
    const now = new Date();
    if (isFuture(new Date(c.start_time))) return { label: "Upcoming", color: "text-blue-400 bg-blue-900/20 border-blue-900/40" };
    if (isPast(new Date(c.end_time)))     return { label: "Ended",    color: "text-gray-400 bg-gray-800 border-gray-700" };
    return { label: "Live", color: "text-green-400 bg-green-900/20 border-green-900/40" };
  };

  return (
    <CandidateShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Contests</h1>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />)}
          </div>
        ) : contests.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No contests available right now</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contests.map((c) => {
              const status = getStatus(c);
              const isEnded = status.label === "Ended";
              const isUpcoming = status.label === "Upcoming";
              return (
                <div key={c.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-6 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="font-semibold text-white text-lg">{c.title}</h2>
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${status.color}`}>
                          {status.label === "Live" && <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse" />}
                          {status.label}
                        </span>
                        {c.proctoring_enabled && (
                          <span className="text-xs flex items-center gap-1 text-violet-400 bg-violet-900/20 border border-violet-900/40 px-2.5 py-1 rounded-full">
                            <Lock className="w-3 h-3" /> Proctored
                          </span>
                        )}
                      </div>
                      {c.description && <p className="text-gray-400 text-sm mb-3 line-clamp-2">{c.description}</p>}
                      <div className="flex items-center gap-5 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> {c.duration_minutes} minutes
                        </span>
                        <span>Starts: {format(new Date(c.start_time), "d MMM yyyy, HH:mm")}</span>
                        <span>Ends: {format(new Date(c.end_time), "d MMM yyyy, HH:mm")}</span>
                        <span className="font-mono bg-gray-800 px-2 py-0.5 rounded">
                          {c.contest_code}
                        </span>
                      </div>
                    </div>
                    {isEnded ? (
                      <Link href={`/candidate/contest/${c.id}/results`}
                        className="ml-6 flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex-shrink-0">
                        View Results <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : isUpcoming ? (
                      <span className="ml-6 inline-flex items-center gap-2 bg-blue-900/20 border border-blue-900/40 text-blue-300 text-sm font-semibold px-5 py-2.5 rounded-xl flex-shrink-0">
                        Starts Soon
                      </span>
                    ) : (
                      <Link href={`/candidate/contest/${c.id}`}
                        className="ml-6 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex-shrink-0">
                        Enter <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CandidateShell>
  );
}
