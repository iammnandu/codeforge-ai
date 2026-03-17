"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CandidateShell } from "@/components/shells/CandidateShell";
import { api } from "@/lib/api";
import { CheckCircle2, Clock } from "lucide-react";
import toast from "react-hot-toast";

export default function CandidateContestSubmittedPage() {
  const { contestId } = useParams();
  const router = useRouter();
  const [seconds, setSeconds] = useState(12);
  const [rating, setRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [checkingResults, setCheckingResults] = useState(true);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const { data } = await api.get(`/contests/${contestId}`);
        const ended = data?.end_time ? new Date(data.end_time).getTime() <= Date.now() : false;
        if (ended) {
          clearInterval(poll);
          router.push(`/candidate/contest/${contestId}/results`);
        }
      } catch {}
    }, 4000);

    const fallbackCountdown = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(fallbackCountdown);
          clearInterval(poll);
          router.push("/candidate/dashboard");
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    const loadingDone = setTimeout(() => setCheckingResults(false), 1200);

    return () => {
      clearTimeout(loadingDone);
      clearInterval(poll);
      clearInterval(fallbackCountdown);
    };
  }, [contestId, router]);

  const submitFeedback = async () => {
    setSendingFeedback(true);
    try {
      await api.post(`/contests/${contestId}/feedback?rating=${rating}&feedback_text=${encodeURIComponent(feedbackText)}`);
      toast.success("Thanks for your feedback!");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to submit feedback");
    } finally {
      setSendingFeedback(false);
    }
  };

  return (
    <CandidateShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Submitted Successfully</h1>
          <p className="text-gray-400 text-sm">
            {checkingResults
              ? "Checking contest status..."
              : "Thank you. Your contest submission is saved."}
          </p>

          <div className="text-xs text-gray-500 flex items-center justify-center gap-1.5 pt-1">
            <Clock className="w-3.5 h-3.5" /> Redirecting to dashboard in {seconds}s
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/candidate/dashboard" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
              Go to Dashboard
            </Link>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Quick Feedback</h3>
          <p className="text-xs text-gray-400">How was your contest experience?</p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => setRating(value)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                  rating === value ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Tell us what can be improved..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none"
          />
          <button
            onClick={submitFeedback}
            disabled={sendingFeedback}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-lg text-sm text-white font-medium"
          >
            {sendingFeedback ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      </div>
    </CandidateShell>
  );
}
