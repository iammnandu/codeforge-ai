"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { OrganizerShell } from "@/components/shells/OrganizerShell";
import { api } from "@/lib/api";
import { ShieldAlert, Code2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

export default function OrganizerCandidateDetailPage() {
  const { contestId, userId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/contests/${contestId}/candidates/${userId}/detail`)
      .then(({ data }) => setData(data))
      .catch((err) => toast.error(err?.response?.data?.detail || "Failed to load candidate detail"))
      .finally(() => setLoading(false));
  }, [contestId, userId]);

  if (loading) {
    return (
      <OrganizerShell>
        <div className="h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </OrganizerShell>
    );
  }

  if (!data) {
    return (
      <OrganizerShell>
        <div className="text-sm text-gray-400">No data found.</div>
      </OrganizerShell>
    );
  }

  return (
    <OrganizerShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Candidate Detail Report</h1>
            <p className="text-sm text-gray-400 mt-1">
              {data?.candidate?.username || `User #${userId}`} • Rank #{data?.result?.rank ?? "-"} • Score {Math.round(data?.result?.score || 0)}
            </p>
          </div>
          <Link
            href={`/organizer/contests/${contestId}/results`}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Results
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500">Candidate</p>
            <p className="text-white font-semibold mt-1">{data?.candidate?.username || `User #${userId}`}</p>
            <p className="text-xs text-gray-400 mt-1">{data?.candidate?.email || "-"}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500">Solved</p>
            <p className="text-white font-semibold mt-1">{data?.result?.solved || 0}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500">Monitoring Score</p>
            <p className={`font-semibold mt-1 ${data?.monitoring?.is_flagged ? "text-red-400" : "text-yellow-300"}`}>
              {Math.round(data?.monitoring?.latest_suspicion_score || 0)}
            </p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 text-sm font-semibold text-white">Problem Summary</div>
          {(data?.problem_summary || []).length === 0 ? (
            <p className="text-sm text-gray-500 p-5">No problems attempted.</p>
          ) : (
            (data?.problem_summary || []).map((row: any) => (
              <div key={row.problem_id} className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-gray-800 last:border-0 text-sm">
                <span className="text-gray-300">{row.problem_title}</span>
                <span className="text-gray-400 capitalize">{String(row.status || "-").replace(/_/g, " ")}</span>
                <span className="text-violet-300">{Math.round(row.score || 0)}%</span>
                <span className="text-yellow-300">{row.earned_points}/{row.points}</span>
                <span className="text-gray-500">Sub #{row.best_submission_id}</span>
              </div>
            ))
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 text-sm font-semibold text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-violet-400" /> Submissions (Code + Testcases)
          </div>
          {(data?.submissions || []).length === 0 ? (
            <p className="text-sm text-gray-500 p-5">No submissions found.</p>
          ) : (
            (data?.submissions || []).map((submission: any) => (
              <div key={submission.submission_id} className="border-b border-gray-800 last:border-0 p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <p className="text-white font-medium">
                    {submission.problem_title} • {submission.language} • {Math.round(submission.score || 0)}%
                  </p>
                  <p className="text-gray-500">{new Date(submission.submitted_at).toLocaleString()}</p>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 overflow-auto max-h-52">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap">{submission.code}</pre>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  {(submission.test_results || []).map((test: any, idx: number) => (
                    <div key={idx} className={`rounded-lg px-3 py-2 text-xs border ${test.passed ? "bg-green-900/20 border-green-900/40 text-green-300" : "bg-red-900/20 border-red-900/40 text-red-300"}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {test.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span className="font-medium">Test {idx + 1}</span>
                      </div>
                      <p>Status: {test.status || (test.passed ? "accepted" : "failed")}</p>
                      {test.expected !== undefined && <p>Expected: {String(test.expected)}</p>}
                      {test.actual !== undefined && <p>Actual: {String(test.actual)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" /> Monitoring Report
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(data?.monitoring?.actions || []).length === 0 ? (
                <span className="text-xs text-gray-500">No enforcement actions recorded.</span>
              ) : (
                (data?.monitoring?.actions || []).map((action: string, idx: number) => (
                  <span key={idx} className="text-xs bg-red-900/20 border border-red-900/40 text-red-300 px-2 py-1 rounded-full">
                    {action}
                  </span>
                ))
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-auto">
              {(data?.monitoring?.events || []).length === 0 ? (
                <p className="text-sm text-gray-500">No monitoring events found.</p>
              ) : (
                (data?.monitoring?.events || []).map((event: any) => (
                  <div key={event.id} className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white">{String(event.event_type).replace(/_/g, " ")}</span>
                      <span className={`capitalize ${event.severity === "critical" ? "text-red-400" : event.severity === "high" ? "text-orange-300" : "text-gray-400"}`}>
                        {event.severity}
                      </span>
                    </div>
                    <p className="text-gray-500">{event.timestamp ? new Date(event.timestamp).toLocaleString() : "-"}</p>
                    <p className="mt-1">Score Delta: {event.score_delta ?? 0}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </OrganizerShell>
  );
}
