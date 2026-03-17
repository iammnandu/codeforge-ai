"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { EnvironmentScan } from "@/components/monitoring/EnvironmentScan";
import { CameraCalibration } from "@/components/monitoring/CameraCalibration";
import { Shield, CheckCircle, ArrowRight, Clock } from "lucide-react";
import { format } from "date-fns";

type Phase = "loading" | "info" | "camera" | "scan" | "calibration" | "ready";

export default function ContestEntryPage() {
  const { contestId } = useParams();
  const router = useRouter();
  const { token, userId } = useAuthStore();

  const [contest, setContest] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionId, setSessionId] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    api.get(`/contests/${contestId}`).then(({ data }) => {
      setContest(data);
      const ended = data?.end_time ? new Date(data.end_time).getTime() <= Date.now() : false;
      if (ended) {
        router.replace(`/candidate/contest/${contestId}/results`);
        return;
      }
      setPhase("info");
    });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wsRef.current?.close();
    };
  }, [contestId]);

  const startCamera = async () => {
    if (contest?.end_time && new Date(contest.end_time).getTime() <= Date.now()) {
      router.replace(`/candidate/contest/${contestId}/results`);
      return;
    }
    setPhase("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      // Start monitoring session
      const { data } = await api.post(`/monitoring/sessions/start?contest_id=${contestId}`);
      setSessionId(data.session_id);

      // Open WebSocket
      const ws = new WebSocket(
        `ws://localhost:8000/api/monitoring/ws/candidate/${data.session_id}?token=${token}`
      );
      wsRef.current = ws;
      ws.onopen = () => {
        if (!contest?.proctoring_enabled) { setPhase("ready"); return; }
        setPhase("scan");
      };
    } catch {
      alert("Camera access is required for this proctored contest.");
    }
  };

  const enterExam = () => {
    // Navigate to the first problem of the contest
    router.push(`/candidate/contest/${contestId}/problems`);
  };

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <video ref={videoRef} autoPlay muted playsInline className="hidden" />
      <div className="w-full max-w-lg">
        {phase === "info" && contest && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" />
                <span className="text-violet-400 text-sm font-medium">Proctored Contest</span>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white mb-2">{contest.title}</h1>
                {contest.description && <p className="text-gray-400 text-sm">{contest.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Duration",   value: `${contest.duration_minutes} minutes` },
                  { label: "Languages",  value: (contest.allowed_languages || []).join(", ") },
                  { label: "Start",      value: format(new Date(contest.start_time), "d MMM, HH:mm") },
                  { label: "End",        value: format(new Date(contest.end_time), "d MMM, HH:mm") },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800/50 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1">{label}</p>
                    <p className="text-white font-medium text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {contest.proctoring_enabled && (
                <div className="bg-violet-950/30 border border-violet-800/30 rounded-xl p-4">
                  <p className="text-violet-300 text-sm font-medium mb-2">🔒 AI Proctoring Active</p>
                  <ul className="space-y-1.5 text-xs text-violet-400/80">
                    {[
                      "Your webcam will be monitored throughout the exam",
                      "A room environment scan is required before starting",
                      "Camera calibration enables off-frame gaze detection",
                      "Tab switching and copy-paste events are recorded",
                    ].map((t, i) => <li key={i} className="flex items-start gap-2"><span className="mt-0.5">•</span>{t}</li>)}
                  </ul>
                </div>
              )}

              <button onClick={startCamera}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                {contest.proctoring_enabled ? "Enable Camera & Continue" : "Enter Contest"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {(phase === "scan" || phase === "calibration") && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Step progress */}
            <div className="flex border-b border-gray-800">
              {[
                { label: "Room Scan", done: phase === "calibration" || phase === "ready" },
                { label: "Calibration", done: phase === "ready" },
              ].map((step, i) => (
                <div key={i} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                  (i === 0 && phase === "scan") || (i === 1 && phase === "calibration")
                    ? "border-violet-500 text-violet-400"
                    : step.done ? "border-green-500 text-green-400" : "border-transparent text-gray-500"
                }`}>
                  {step.done ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs">{i+1}</span>}
                  {step.label}
                </div>
              ))}
            </div>

            <div className="h-[460px]">
              {phase === "scan" && (
                <EnvironmentScan
                  videoRef={videoRef}
                  wsRef={wsRef}
                  onComplete={(clean) => {
                    if (clean) {
                      setPhase("calibration");
                      return;
                    }
                    setPhase("scan");
                  }}
                />
              )}
              {phase === "calibration" && (
                <CameraCalibration
                  sessionId={sessionId}
                  wsRef={wsRef}
                  videoRef={videoRef}
                  onComplete={() => {
                    setPhase("ready");
                    router.push(`/candidate/contest/${contestId}/problems`);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {phase === "ready" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
              <p className="text-gray-400 text-sm">Environment verified. Camera calibrated. AI monitoring active.</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-sm text-gray-400 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Timer starts when you click Enter
            </div>
            <button onClick={enterExam}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl transition-colors text-lg">
              Enter Contest →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
