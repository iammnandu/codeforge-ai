"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { OrganizerShell } from "@/components/shells/OrganizerShell";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Copy, Mail, Eye, Users, BarChart3, Send } from "lucide-react";
import { format } from "date-fns";

export default function ContestDetailPage() {
  const { contestId } = useParams();
  const router = useRouter();
  const [contest, setContest] = useState<any>(null);
  const [problems, setProblems] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<"overview" | "problems" | "participants" | "invite">("overview");

  useEffect(() => {
    api.get(`/contests/${contestId}`).then(({ data }) => setContest(data));
    api.get(`/problems?contest_id=${contestId}`).then(({ data }) => setProblems(data)).catch(() => {});
    api.get(`/contests/${contestId}/leaderboard`).then(({ data }) => setParticipants(data)).catch(() => {});
  }, [contestId]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/candidate/contest/${contestId}`);
    toast.success("Contest link copied!");
  };

  const copyCode = () => {
    if (contest?.contest_code) {
      navigator.clipboard.writeText(contest.contest_code);
      toast.success("Contest code copied!");
    }
  };

  const sendInvites = async () => {
    const list = emails.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean);
    if (!list.length) { toast.error("Enter at least one email"); return; }
    setSending(true);
    try {
      await api.post(`/contests/${contestId}/invite`, list);
      toast.success(`Invites sent to ${list.length} participants`);
      setEmails("");
    } catch {
      toast.error("Failed to send invites");
    } finally {
      setSending(false);
    }
  };

  const publishContest = async () => {
    try {
      await api.put(`/contests/${contestId}/publish`);
      toast.success("Contest published!");
      setContest((c: any) => ({ ...c, is_published: true }));
    } catch {
      toast.error("Failed to publish");
    }
  };

  const endContestNow = async () => {
    try {
      await api.put(`/contests/${contestId}/end`);
      toast.success("Contest ended. Results are now available.");
      setContest((c: any) => c ? { ...c, is_active: false } : c);
      router.push(`/organizer/contests/${contestId}/results`);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to end contest");
    }
  };

  const addBasicProblems = async () => {
    try {
      const { data } = await api.post(`/contests/${contestId}/problems/bootstrap-basic`);
      toast.success(`Added ${data.added_count || 0} basic problems`);
      const { data: refreshed } = await api.get(`/problems?contest_id=${contestId}`);
      setProblems(refreshed);
      setTab("problems");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to add basic problems");
    }
  };

  if (!contest) return (
    <OrganizerShell>
      <div className="h-48 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </OrganizerShell>
  );

  const TABS = [
    { id: "overview",     label: "Overview" },
    { id: "problems",     label: `Problems (${problems.length})` },
    { id: "participants", label: `Participants (${participants.length})` },
    { id: "invite",       label: "Invite" },
  ];
  const isEnded = !!contest?.end_time && new Date(contest.end_time).getTime() <= Date.now();

  return (
    <OrganizerShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{contest.title}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                contest.is_published ? "bg-green-900/30 text-green-400 border-green-900/40" : "bg-gray-800 text-gray-400 border-gray-700"
              }`}>{contest.is_published ? "Published" : "Draft"}</span>
            </div>
            <p className="text-gray-400 text-sm">{format(new Date(contest.start_time), "d MMM yyyy, HH:mm")} — {format(new Date(contest.end_time), "HH:mm")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/organizer/contests/${contestId}/results`}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-xl text-sm transition-colors">
              <BarChart3 className="w-4 h-4" /> Results
            </Link>
            {!isEnded && (
              <button
                onClick={endContestNow}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                End Contest
              </button>
            )}
            <Link href={`/organizer/proctor/${contestId}`}
              className="flex items-center gap-2 bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 px-4 py-2 rounded-xl text-sm transition-colors">
              <Eye className="w-4 h-4" /> Monitor
            </Link>
            {!contest.is_published && (
              <button onClick={publishContest}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                Publish
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
              }`}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white">Contest Code</h3>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold font-mono text-violet-400 tracking-widest">{contest.contest_code}</span>
                <button onClick={copyCode} className="text-gray-500 hover:text-white transition-colors">
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              <button onClick={copyLink}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2.5 rounded-xl transition-colors">
                <Copy className="w-4 h-4" /> Copy invite link
              </button>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-3">Details</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Duration", `${contest.duration_minutes} minutes`],
                  ["Languages", (contest.allowed_languages || []).join(", ")],
                  ["Proctoring", contest.proctoring_enabled ? "Enabled" : "Disabled"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "problems" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link href={`/organizer/problems/new?contest=${contestId}`}
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2.5 rounded-xl font-semibold transition-colors">
                <Plus className="w-4 h-4" /> Add Problem
              </Link>
              <Link href={`/organizer/problems/new?contest=${contestId}`}
                className="inline-flex items-center gap-2 bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 text-sm px-4 py-2.5 rounded-xl font-semibold transition-colors">
                Generate with AI
              </Link>
              <button
                onClick={addBasicProblems}
                className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm px-4 py-2.5 rounded-xl font-semibold transition-colors"
              >
                Add Basic Problems
              </button>
            </div>
            {problems.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                <span className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-sm font-bold text-gray-400">
                  {String.fromCharCode(65 + i)}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-white">{p.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">{p.difficulty}</p>
                </div>
                <Link href={`/organizer/problems/${p.id}`} className="text-sm text-gray-400 hover:text-white transition-colors">Edit</Link>
              </div>
            ))}
          </div>
        )}

        {tab === "participants" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider font-medium">
              <span>Rank</span><span>User ID</span><span>Score</span><span>Joined</span>
            </div>
            {participants.map((p, i) => (
              <div key={p.user_id} className="grid grid-cols-4 gap-4 px-5 py-4 border-b border-gray-800 last:border-0 text-sm">
                <span className={`font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-gray-500"}`}>
                  #{i + 1}
                </span>
                <span className="text-gray-300">User #{p.user_id}</span>
                <span className="text-white font-semibold">{Math.round(p.score)}</span>
                <span className="text-gray-500">{format(new Date(p.joined_at), "d MMM, HH:mm")}</span>
              </div>
            ))}
            {participants.length === 0 && (
              <p className="text-center py-10 text-gray-500 text-sm">No participants yet</p>
            )}
          </div>
        )}

        {tab === "invite" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5 max-w-lg">
            <div>
              <h3 className="font-semibold text-white mb-1">Send Email Invitations</h3>
              <p className="text-gray-400 text-sm">One email per line, or comma-separated</p>
            </div>
            <textarea
              value={emails} onChange={(e) => setEmails(e.target.value)} rows={6}
              placeholder={"alice@example.com\nbob@example.com\ncarol@example.com"}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-violet-500 resize-none"
            />
            <button onClick={sendInvites} disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
              <Send className="w-4 h-4" />
              {sending ? "Sending…" : "Send Invites"}
            </button>
          </div>
        )}
      </div>
    </OrganizerShell>
  );
}
