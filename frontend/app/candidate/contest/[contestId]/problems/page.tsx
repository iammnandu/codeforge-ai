"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Clock, CheckCircle, Circle, Trophy } from "lucide-react";
import toast from "react-hot-toast";

export default function ContestProblemsPage() {
  const { contestId } = useParams();
  const [contest, setContest] = useState<any>(null);
  const [problems, setProblems] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<number, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<any>(null);
  const [finishing, setFinishing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const autoSubmitRef = useRef(false);

  useEffect(() => {
    api.get(`/contests/${contestId}`).then(({ data }) => {
      setContest(data);
      const end = new Date(data.end_time).getTime();
      const updateTimer = () => setTimeLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    });
    api.get(`/problems?contest_id=${contestId}`).then(({ data }) => setProblems(data));
    api.get("/submissions/my").then(({ data }) => {
      const map: Record<number, any> = {};
      (data as any[]).filter((s) => s.contest_id === +contestId!).forEach((s) => {
        if (!map[s.problem_id] || s.score > map[s.problem_id].score) map[s.problem_id] = s;
      });
      setSubmissions(map);
    });
    return () => clearInterval(timerRef.current);
  }, [contestId]);

  const finishContest = async () => {
    if (finishing || submitted) return;
    setFinishing(true);
    try {
      await api.post(`/contests/${contestId}/finish`);
      setSubmitted(true);
      toast.success("Contest submitted successfully");
      const endedNow = (timeLeft ?? 0) <= 0;
      window.location.href = endedNow
        ? `/candidate/contest/${contestId}/results`
        : `/candidate/contest/${contestId}/submitted`;
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to submit contest");
    } finally {
      setFinishing(false);
    }
  };

  useEffect(() => {
    if (timeLeft !== 0) return;
    if (autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    toast.success("Time limit reached. Submitting and opening results...");
    finishContest();
  }, [timeLeft]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
                 : `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Contest header bar */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-4 h-4 text-violet-400" />
          <span className="font-semibold text-white">{contest?.title}</span>
        </div>
        {timeLeft !== null && (
          <div className={`flex items-center gap-2 font-mono font-bold text-lg ${
            timeLeft < 300 ? "text-red-400" : timeLeft < 900 ? "text-yellow-400" : "text-green-400"
          }`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={finishContest}
            disabled={finishing || submitted}
            className="text-sm px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-medium transition-colors"
          >
            {submitted ? "Submitted" : finishing ? "Submitting..." : "Submit Contest"}
          </button>
          {submitted && (
            <span className="text-sm text-gray-400">Submitted</span>
          )}
        </div>
      </div>

      {/* Problems */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-lg font-semibold text-white mb-6">Problems</h2>
        <div className="space-y-3">
          {problems.map((p, i) => {
            const sub = submissions[p.id];
            const solved = sub?.status === "accepted";
            const attempted = !!sub;
            return (
              <Link key={p.id} href={`/candidate/ide/${p.id}?contest=${contestId}`}
                className="flex items-center gap-5 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-all group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  solved ? "bg-green-900/30 text-green-400" : attempted ? "bg-yellow-900/30 text-yellow-400" : "bg-gray-800 text-gray-400"
                }`}>
                  {String.fromCharCode(65 + i)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white group-hover:text-violet-300 transition-colors">{p.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs capitalize px-2 py-0.5 rounded-full ${
                      p.difficulty === "easy" ? "bg-green-900/30 text-green-400" :
                      p.difficulty === "medium" ? "bg-yellow-900/30 text-yellow-400" : "bg-red-900/30 text-red-400"
                    }`}>{p.difficulty}</span>
                    {sub && <span className="text-xs text-gray-500">Score: {Math.round(sub.score)}%</span>}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {solved ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Circle className="w-5 h-5 text-gray-600" />}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
