"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trophy, Users, Eye, BarChart3, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { format } from "date-fns";
import { OrganizerShell } from "@/components/shells/OrganizerShell";

interface Contest {
  id: number; title: string; contest_code: string;
  start_time: string; end_time: string; is_published: boolean;
  duration_minutes: number; proctoring_enabled: boolean;
}

export default function OrganizerDashboard() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/contests").then(({ data }) => { setContests(data); setLoading(false); });
  }, []);

  const stats = [
    { label: "Total Contests", value: contests.length, icon: <Trophy className="w-5 h-5 text-violet-400" /> },
    { label: "Published", value: contests.filter((c) => c.is_published).length, icon: <BarChart3 className="w-5 h-5 text-green-400" /> },
    { label: "Proctored",  value: contests.filter((c) => c.proctoring_enabled).length, icon: <Eye className="w-5 h-5 text-blue-400" /> },
  ];

  return (
    <OrganizerShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Manage your coding contests</p>
          </div>
          <Link href="/organizer/contests/new"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> New Contest
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">{s.label}</span>
                {s.icon}
              </div>
              <div className="text-3xl font-bold text-white">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Contests list */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Your Contests</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : contests.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No contests yet.</p>
              <Link href="/organizer/contests/new" className="text-violet-400 hover:text-violet-300 text-sm mt-2 inline-block">
                Create your first contest →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {contests.map((c) => (
                <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-700 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-white">{c.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.is_published ? "bg-green-900/40 text-green-400" : "bg-gray-800 text-gray-400"
                      }`}>{c.is_published ? "Published" : "Draft"}</span>
                      {c.proctoring_enabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-900/40 text-violet-400">
                          🔒 Proctored
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(c.start_time), "d MMM yyyy, HH:mm")}
                      </span>
                      <span>Code: <strong className="text-gray-300 font-mono">{c.contest_code}</strong></span>
                      <span>{c.duration_minutes} min</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Link href={`/organizer/proctor/${c.id}`}
                      className="text-xs px-3 py-2 bg-violet-900/30 hover:bg-violet-900/50 text-violet-400 rounded-lg transition-colors flex items-center gap-1.5">
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
      </div>
    </OrganizerShell>
  );
}
