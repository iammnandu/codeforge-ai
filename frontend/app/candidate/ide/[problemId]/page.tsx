"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Play, Send, Camera, Shield, AlertTriangle,
  CheckCircle2, XCircle, Clock, Zap, Code2, Settings,
  Info, BarChart3, Terminal, Maximize2, Minimize2, FileText,
  ArrowLeft, Home, ChevronRight
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import toast from "react-hot-toast";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const STARTER_CODE: Record<string, string> = {
  python: `def solve():\n    # Read input\n    n = int(input())\n    # Write your solution here\n    print(n)\n\nsolve()\n`,
  cpp:    `#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    // Write your solution here\n    cout << n << endl;\n    return 0;\n}\n`,
  java:   `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Write your solution here\n        System.out.println(n);\n    }\n}\n`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\n// Write your solution here\nconsole.log(n);\n`,
};

const LANG_DISPLAY: Record<string, string> = {
  python: "Python 3",
  cpp: "C++17",
  java: "Java 11",
  javascript: "Node.js"
};

export default function IDEPage() {
  const { problemId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const contestId = searchParams.get("contest");
  const { token, userId } = useAuthStore();

  const [problem, setProblem] = useState<any>(null);
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState(STARTER_CODE.python);
  const [activeTab, setActiveTab] = useState<"testcases"|"results">("testcases");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState(0);
  const [suspicionScore, setSuspicionScore] = useState(0);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<"pending"|"granted"|"denied">("pending");
  const [fontSize, setFontSize] = useState(14);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contestPaused, setContestPaused] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const [contestEnded, setContestEnded] = useState(false);
  const [endMessage, setEndMessage] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<any>(null);
  const reconnectRef = useRef<any>(null);
  const contestWatcherRef = useRef<any>(null);

  const pushCandidateNotification = (text: string, href: string) => {
    if (typeof window === "undefined") return;
    try {
      const key = "cf_notifications_candidate";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      const next = [{ id: `cand-${Date.now()}`, text, href }, ...current].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    api.get(`/problems/${problemId}`).then(({ data }) => setProblem(data));
    if (contestId) startMonitoringSession();
    setupBrowserEventListeners();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wsRef.current?.close();
      clearInterval(frameIntervalRef.current);
      clearTimeout(reconnectRef.current);
      clearInterval(contestWatcherRef.current);
    };
  }, []);

  useEffect(() => {
    if (!contestId) return;
    contestWatcherRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/contests/${contestId}`);
        const ended = data?.end_time ? new Date(data.end_time).getTime() <= Date.now() : false;
        if (ended) {
          setContestEnded(true);
          setEndMessage("Contest ended. Redirecting to results page.");
        }
      } catch {}
    }, 5000);
    return () => clearInterval(contestWatcherRef.current);
  }, [contestId]);

  useEffect(() => {
    if (!contestEnded || !contestId) return;
    const timeout = setTimeout(() => {
      window.location.href = `/candidate/contest/${contestId}/results`;
    }, 1200);
    return () => clearTimeout(timeout);
  }, [contestEnded, contestId]);

  const startMonitoringSession = async () => {
    try {
      const { data } = await api.post(`/monitoring/sessions/start?contest_id=${contestId}`);
      sessionIdRef.current = data.session_id;
      await startCamera();
    } catch (e) { console.error("Monitoring init failed", e); }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraPermission("granted");
      setMonitoringActive(true);
      connectMonitoringWS();
    } catch {
      setCameraPermission("denied");
      toast.error("Camera access required for proctored contests");
    }
  };

  const connectMonitoringWS = () => {
    const ws = new WebSocket(`ws://localhost:8000/api/monitoring/ws/candidate/${sessionIdRef.current}`);
    wsRef.current = ws;
    ws.onopen = () => {
      clearTimeout(reconnectRef.current);
      setMonitoringActive(true);
      frameIntervalRef.current = setInterval(sendFrame, 500);
    };
    ws.onclose = () => {
      setMonitoringActive(false);
      clearInterval(frameIntervalRef.current);
      reconnectRef.current = setTimeout(() => {
        if (sessionIdRef.current && !disqualified) connectMonitoringWS();
      }, 1000);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "result") {
        setSuspicionScore(msg.suspicion_score);
        if (msg.flags?.length) {
          msg.flags.forEach((f: string) => {
            if (f === "multiple_faces") toast.error("Multiple people detected in camera — malpractice", { id: "face" });
            if (f === "cell_phone_detected") toast.error("Phone detected!", { id: "phone" });
          });
        }
        if (msg.action === "warning") {
          toast.error(msg.message || "Warning: malpractice signal detected", { id: "warn-malpractice" });
        }
        if (msg.action === "pause") {
          setContestPaused(true);
          setContestEnded(true);
          setEndMessage(msg.message || "Malpractice detected. Contest ended for this attempt.");
          pushCandidateNotification(
            "Malpractice check failed: contest paused for your attempt",
            contestId ? `/candidate/contest/${contestId}/results` : "/candidate/dashboard"
          );
          toast.error(msg.message || "Contest paused due to repeated malpractice", { id: "pause-malpractice" });
        }
        if (msg.action === "disqualify") {
          setDisqualified(true);
          setContestPaused(true);
          setContestEnded(true);
          setEndMessage(msg.message || "Malpractice detected repeatedly. Contest ended for this attempt.");
          pushCandidateNotification(
            "Malpractice check failed: you were disqualified",
            contestId ? `/candidate/contest/${contestId}/results` : "/candidate/dashboard"
          );
          toast.error(msg.message || "You are disqualified", { id: "dq-malpractice" });
        }
      }
    };
  };

  const sendFrame = () => {
    if (!canvasRef.current || !videoRef.current || !wsRef.current || wsRef.current.readyState !== 1) return;
    if (videoRef.current.readyState < 2) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    const frame = canvasRef.current.toDataURL("image/jpeg", 0.6).split(",")[1];
    wsRef.current.send(JSON.stringify({
      type: "frame", frame,
      contest_id: contestId ? +contestId : null,
      user_id: userId,
      username: "candidate",
    }));
  };

  const setupBrowserEventListeners = () => {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: "behavior_event", event: { type: "tab_switch" } }));
      }
    });
    window.addEventListener("blur", () => {
      if (wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: "behavior_event", event: { type: "window_blur" } }));
      }
    });
    document.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text") || "";
      if (wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: "behavior_event", event: { type: "paste", data: { chars: text.length } } }));
      }
    });
  };

  const runCode = async () => {
    if (contestPaused || disqualified) {
      toast.error(disqualified ? "You are disqualified from this contest" : "Contest is paused. Contact organizer.");
      return;
    }
    setRunning(true);
    setTestResults([]);
    setActiveTab("results");
    try {
      const { data } = await api.post("/submissions", {
        problem_id: +problemId!, contest_id: contestId ? +contestId : null,
        language: lang, code,
      });
      
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const { data: sub } = await api.get(`/submissions/${data.id}`);
        if (sub.status !== "pending" && sub.status !== "running") {
          clearInterval(poll);
          setTestResults(sub.test_results || []);
          setRunning(false);
          
          const passed = (sub.test_results || []).filter((r: any) => r.passed).length;
          const total = (sub.test_results || []).length;
          
          if (passed === total) {
            toast.success(`All tests passed! 🎉`, { duration: 3000 });
          } else {
            toast.error(`${passed}/${total} tests passed`, { duration: 3000 });
          }
        }
        if (attempts > 20) { clearInterval(poll); setRunning(false); }
      }, 1000);
    } catch (err: any) {
      toast.error("Error: " + (err.response?.data?.detail || "Unknown error"));
      setRunning(false);
    }
  };

  const submitCode = async () => {
    if (contestPaused || disqualified) {
      toast.error(disqualified ? "You are disqualified from this contest" : "Contest is paused. Contact organizer.");
      return;
    }
    setSubmitting(true);
    await runCode();
    setSubmitting(false);
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Back Navigation */}
          <button
            onClick={() => contestId ? router.push(`/candidate/contest/${contestId}/problems`) : router.push('/candidate/dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </button>
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Home className="w-3.5 h-3.5" />
            <ChevronRight className="w-3.5 h-3.5" />
            {contestId ? (
              <>
                <Link href={`/candidate/contest/${contestId}/problems`} className="hover:text-white transition-colors">
                  Contest
                </Link>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <Link href="/candidate/dashboard" className="hover:text-white transition-colors">
                  Dashboard
                </Link>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
            <span className="text-white font-medium">{problem?.title || "Problem"}</span>
          </div>
          
          {/* Difficulty Badge */}
          {problem && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              problem?.difficulty === "easy" ? "bg-green-900/40 text-green-400" :
              problem?.difficulty === "medium" ? "bg-yellow-900/40 text-yellow-400" :
              "bg-red-900/40 text-red-400"
            }`}>{problem.difficulty}</span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {contestId && (
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
              monitoringActive
                ? "bg-green-900/40 text-green-400 border-green-900/50"
                : "bg-red-900/40 text-red-400 border-red-900/50"
            }`}>
              <Camera className="w-3.5 h-3.5" />
              <span className="font-medium">{monitoringActive ? `Monitored (${Math.round(suspicionScore)})` : "Camera Off"}</span>
            </div>
          )}
          
          <button onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {contestEnded && contestId && (
          <div className="absolute inset-0 z-40 bg-gray-950 flex items-center justify-center px-6">
            <div className="max-w-lg w-full bg-gray-900 border border-red-900/40 rounded-2xl p-8 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
              <h2 className="text-2xl font-bold text-white">Contest Ended</h2>
              <p className="text-sm text-gray-400">{endMessage || "Your contest session is closed."}</p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  onClick={() => window.location.href = `/candidate/contest/${contestId}/results`}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm font-medium"
                >
                  Go to Result Page
                </button>
                <button
                  onClick={() => window.location.href = "/candidate/dashboard"}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm font-medium"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {contestPaused && contestId && (
          <div className="absolute inset-0 z-30 bg-black/75 flex items-center justify-center">
            <div className="bg-gray-900 border border-red-900/40 rounded-2xl p-8 max-w-md text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">{disqualified ? "Disqualified" : "Contest Paused"}</h2>
              <p className="text-sm text-gray-400">
                {disqualified
                  ? "Repeated malpractice was detected. Your contest attempt has been blocked."
                  : "Repeated critical warnings were detected. Remove forbidden items and contact organizer."}
              </p>
              <button
                onClick={() => window.location.href = `/candidate/contest/${contestId}/results`}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm font-medium"
              >
                Go to Result Page
              </button>
            </div>
          </div>
        )}
        {/* Left Panel - Problem Description */}
        {!isFullscreen && (
          <div className="w-[480px] border-r border-gray-800 overflow-y-auto bg-gray-900 flex-shrink-0">
            <div className="p-6 space-y-6">
              {/* Problem Description */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Info className="w-4 h-4" />
                  <span>Problem Description</span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{problem?.description}</p>
                </div>
              </div>

              {/* Examples */}
              {problem?.sample_input && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Example
                  </h3>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-gray-900 border-b border-gray-700">
                      <span className="text-xs font-medium text-gray-400">Input</span>
                    </div>
                    <pre className="px-4 py-3 text-sm text-gray-300 font-mono">{problem.sample_input}</pre>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-gray-900 border-b border-gray-700">
                      <span className="text-xs font-medium text-gray-400">Output</span>
                    </div>
                    <pre className="px-4 py-3 text-sm text-gray-300 font-mono">{problem.sample_output}</pre>
                  </div>
                </div>
              )}

              {/* Constraints */}
              {problem?.constraints && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Constraints</h3>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
                    <p className="text-sm text-gray-400 font-mono">{problem.constraints}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Panel - Code Editor & Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900 flex-shrink-0">
            <div className="flex items-center gap-3">
              <select 
                value={lang} 
                onChange={(e) => { setLang(e.target.value); setCode(STARTER_CODE[e.target.value]); }}
                className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500 transition-colors">
                {Object.entries(LANG_DISPLAY).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              
              <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-2">
                <Settings className="w-3.5 h-3.5 text-gray-500" />
                <select 
                  value={fontSize}
                  onChange={(e) => setFontSize(+e.target.value)}
                  className="bg-transparent text-gray-300 text-xs py-1.5 focus:outline-none">
                  <option value={12}>12px</option>
                  <option value={14}>14px</option>
                  <option value={16}>16px</option>
                  <option value={18}>18px</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={runCode} 
                disabled={running || contestPaused || disqualified}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-all border border-gray-700 hover:border-gray-600">
                <Play className="w-4 h-4" />
                {running ? "Running..." : "Run Code"}
              </button>
              <button 
                onClick={submitCode} 
                disabled={submitting || running || contestPaused || disqualified}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-all font-medium">
                <Send className="w-4 h-4" />
                Submit
              </button>
            </div>
          </div>

          {/* Code Editor */}
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              height="100%"
              language={lang === "cpp" ? "cpp" : lang === "javascript" ? "javascript" : lang}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v || "")}
              options={{
                fontSize: fontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                wordWrap: "on",
                padding: { top: 16, bottom: 16 },
                renderLineHighlight: "all",
                cursorBlinking: "smooth",
                smoothScrolling: true,
                contextmenu: false,
              }}
            />
          </div>

          {/* Test Cases / Results Panel */}
          <div className="h-72 border-t border-gray-800 bg-gray-900 flex flex-col flex-shrink-0">
            {/* Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800">
              <button
                onClick={() => setActiveTab("testcases")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "testcases"
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}>
                Test Cases
              </button>
              <button
                onClick={() => setActiveTab("results")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === "results"
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}>
                <BarChart3 className="w-4 h-4" />
                Results
                {testResults.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    testResults.every(r => r.passed)
                      ? "bg-green-900/40 text-green-400"
                      : "bg-red-900/40 text-red-400"
                  }`}>
                    {testResults.filter(r => r.passed).length}/{testResults.length}
                  </span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              {activeTab === "testcases" && (
                <div className="p-4 space-y-4">
                  {problem?.sample_input && problem?.sample_output ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <FileText className="w-4 h-4" />
                        <span>Sample Test Case</span>
                      </div>
                      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-400">Input</span>
                          <span className="text-xs text-gray-500">stdin</span>
                        </div>
                        <pre className="px-4 py-3 text-sm text-gray-300 font-mono">{problem.sample_input}</pre>
                      </div>
                      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-400">Expected Output</span>
                          <span className="text-xs text-gray-500">stdout</span>
                        </div>
                        <pre className="px-4 py-3 text-sm text-green-400 font-mono">{problem.sample_output}</pre>
                      </div>
                      <div className="bg-violet-900/20 border border-violet-800/30 rounded-xl px-4 py-3">
                        <p className="text-xs text-violet-300">
                          💡 <strong>Tip:</strong> Your code will be tested against multiple hidden test cases. Make sure it handles edge cases!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">
                      No sample test cases available
                    </div>
                  )}
                </div>
              )}

              {activeTab === "results" && (
                <div className="h-full">
                  {testResults.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      {running ? (
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                          <span>Running your code...</span>
                        </div>
                      ) : (
                        "Click 'Run Code' to see results"
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full">
                      {/* Test Case List */}
                      <div className="w-48 border-r border-gray-800 overflow-y-auto">
                        {testResults.map((result, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedTest(i)}
                            className={`w-full px-4 py-3 text-left border-b border-gray-800 transition-colors ${
                              selectedTest === i ? "bg-gray-800" : "hover:bg-gray-800/50"
                            }`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-white">Test {result.test_case || i + 1}</span>
                              {result.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {result.time_ms !== undefined ? `${result.time_ms}ms` : "N/A"}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Test Case Details */}
                      <div className="flex-1 overflow-y-auto p-4">
                        {testResults[selectedTest] && (
                          <div className="space-y-4">
                            {/* Status Header */}
                            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                              testResults[selectedTest].passed
                                ? "bg-green-900/40 border-green-900/50"
                                : "bg-red-900/40 border-red-900/50"
                            }`}>
                              {testResults[selectedTest].passed ? (
                                <>
                                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                                  <div>
                                    <div className="font-semibold text-green-400">Accepted</div>
                                    <div className="text-sm text-green-400/70">Test case passed successfully</div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-6 h-6 text-red-400" />
                                  <div>
                                    <div className="font-semibold text-red-400">
                                      {testResults[selectedTest].status?.replace(/_/g, ' ').toUpperCase()}
                                    </div>
                                    <div className="text-sm text-red-400/70">Test case failed</div>
                                  </div>
                                </>
                              )}
                              <div className="ml-auto flex items-center gap-2 text-sm">
                                <Zap className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-300 font-mono">
                                  {testResults[selectedTest].time_ms !== undefined 
                                    ? `${testResults[selectedTest].time_ms}ms` 
                                    : "N/A"}
                                </span>
                              </div>
                            </div>

                            {/* Error Message */}
                            {testResults[selectedTest].error && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-400">Error Message</div>
                                <div className="bg-gray-800 border border-red-900/50 rounded-xl p-4">
                                  <pre className="text-sm text-red-400 font-mono whitespace-pre-wrap">
                                    {testResults[selectedTest].error}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Expected vs Actual Output */}
                            {testResults[selectedTest].expected && testResults[selectedTest].actual && (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-gray-400">Expected Output</div>
                                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                                      {testResults[selectedTest].expected}
                                    </pre>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-gray-400">Your Output</div>
                                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                                    <pre className={`text-sm font-mono whitespace-pre-wrap ${
                                      testResults[selectedTest].passed ? "text-green-400" : "text-red-400"
                                    }`}>
                                      {testResults[selectedTest].actual}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Webcam Panel (Proctored Only) */}
        {contestId && !isFullscreen && (
          <div className="w-64 border-l border-gray-800 bg-gray-900 flex-shrink-0 flex flex-col">
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                <Shield className="w-4 h-4" />
                <span className="font-medium">Proctoring</span>
              </div>
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-gray-800">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {cameraPermission === "denied" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <AlertTriangle className="w-8 h-8 text-rose-400" />
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} width={320} height={240} className="hidden" />
            </div>

            {/* Suspicion Score */}
            <div className="p-4 space-y-3">
              <div className="text-sm font-medium text-gray-400">Integrity Score</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Current</span>
                  <span className={`font-bold font-mono ${
                    suspicionScore >= 70 ? "text-red-400" :
                    suspicionScore >= 40 ? "text-yellow-400" : "text-green-400"
                  }`}>{Math.round(100 - suspicionScore)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      suspicionScore >= 70 ? "bg-red-500" :
                      suspicionScore >= 40 ? "bg-yellow-500" : "bg-green-500"
                    }`} 
                    style={{ width: `${100 - suspicionScore}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob
