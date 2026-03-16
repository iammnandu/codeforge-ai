"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Shield, AlertTriangle, Users, Activity } from "lucide-react";
import { OrganizerShell } from "@/components/shells/OrganizerShell";
import { useAuthStore } from "@/lib/store";

interface CandidateState {
  session_id: number;
  user_id: number;
  username: string;
  suspicion_score: number;
  severity: string;
  flags: string[];
  agent_results: any;
  should_alert: boolean;
  last_update: number;
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  clean:    { color: "text-green-400",  bg: "bg-green-900/20 border-green-900/40",  label: "Clean" },
  low:      { color: "text-blue-400",   bg: "bg-blue-900/20 border-blue-900/40",    label: "Low" },
  medium:   { color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-900/40",label: "Medium" },
  high:     { color: "text-orange-400", bg: "bg-orange-900/20 border-orange-900/40",label: "High" },
  critical: { color: "text-red-400",    bg: "bg-red-900/20 border-red-900/40",      label: "Critical" },
};

export default function ProctorDashboard() {
  const { contestId } = useParams();
  const token = useAuthStore((s) => s.token);
  const [candidates, setCandidates] = useState<Record<number, CandidateState>>({});
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:8000/api/monitoring/ws/proctor/${contestId}?token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "ping") return;

      if (msg.type === "update" || msg.type === "snapshot") {
        setCandidates((prev) => ({
          ...prev,
          [msg.session_id]: { ...msg, last_update: Date.now() },
        }));

        if (msg.should_alert) {
          const alertMsg = `⚠ ${msg.username}: ${msg.flags.join(", ")}`;
          setAlerts((a) => [alertMsg, ...a.slice(0, 19)]);
        }
      }
    };

    return () => ws.close();
  }, [contestId, token]);

  const candidateList = Object.values(candidates).sort((a, b) => b.suspicion_score - a.suspicion_score);
  const flagged = candidateList.filter((c) => c.suspicion_score >= 70).length;

  return (
    <OrganizerShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Live Proctor Dashboard</h1>
            <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${
              connected ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
              {connected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Candidates", value: candidateList.length, icon: <Users className="w-5 h-5 text-blue-400" /> },
            { label: "Flagged",   value: flagged, icon: <AlertTriangle className="w-5 h-5 text-red-400" /> },
            { label: "Avg Score", value: candidateList.length ? Math.round(candidateList.reduce((s, c) => s + c.suspicion_score, 0) / candidateList.length) : 0,
              icon: <Activity className="w-5 h-5 text-violet-400" /> },
          ].map((s, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">{s.label}</span>{s.icon}
              </div>
              <div className="text-3xl font-bold text-white">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Candidate grid */}
          <div className="col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Candidates</h2>
            {candidateList.length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Waiting for candidates to connect…</p>
              </div>
            ) : (
              candidateList.map((c) => {
                const cfg = SEVERITY_CONFIG[c.severity] || SEVERITY_CONFIG.clean;
                const score = Math.round(c.suspicion_score);
                return (
                  <div key={c.session_id}
                    className={`border rounded-xl p-4 transition-all ${cfg.bg} ${c.should_alert ? "suspicion-critical" : ""}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">
                          {c.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{c.username}</p>
                          <p className="text-xs text-gray-500">Session #{c.session_id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${cfg.color}`}>{score}</div>
                        <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mb-3">
                      <div className={`h-1.5 rounded-full transition-all duration-500 ${
                        score >= 70 ? "bg-red-500" : score >= 40 ? "bg-yellow-500" : "bg-green-500"
                      }`} style={{ width: `${score}%` }} />
                    </div>

                    {/* Agent status */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[
                        { key: "face",     label: "Face",    val: c.agent_results?.face?.face_present ? "✓" : "✗",
                          ok: c.agent_results?.face?.face_present },
                        { key: "objects",  label: "Objects", val: c.agent_results?.objects?.phone ? "📱" : "✓",
                          ok: !c.agent_results?.objects?.phone },
                        { key: "gaze",     label: "Gaze",    val: c.agent_results?.gaze?.looking_away ? "⚠" : "✓",
                          ok: !c.agent_results?.gaze?.looking_away },
                        { key: "behavior", label: "Behavior",val: (c.agent_results?.behavior?.tab_switches || 0) > 0 ? "⚠" : "✓",
                          ok: (c.agent_results?.behavior?.tab_switches || 0) === 0 },
                      ].map((agent) => (
                        <div key={agent.key}
                          className={`rounded-lg p-2 text-center ${agent.ok ? "bg-gray-800/60" : "bg-red-900/30 border border-red-800/30"}`}>
                          <div className="text-base">{agent.val}</div>
                          <div className="text-gray-500 mt-0.5">{agent.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Flags */}
                    {c.flags && c.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {c.flags.map((f, i) => (
                          <span key={i} className="text-xs bg-red-900/30 text-red-400 border border-red-900/40 px-2 py-0.5 rounded-full">
                            {f.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Alert feed */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Alert Feed</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl h-[600px] overflow-y-auto p-3 space-y-2">
              {alerts.length === 0 ? (
                <p className="text-xs text-gray-600 text-center pt-8">No alerts yet</p>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className="text-xs bg-red-900/20 border border-red-900/30 text-red-300 rounded-lg px-3 py-2">
                    {a}
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
