
"use client";
/**
 * EnvironmentScan.tsx
 * ───────────────────
 * Pre-exam room scan: candidate slowly pans camera around their workspace.
 * Frames are sent to backend which runs YOLOv8 to detect forbidden objects.
 * Results are shown live. Organizer is notified of any room violations.
 */
import { useState, useRef, useEffect } from "react";
import { Camera, RotateCcw, CheckCircle, AlertTriangle } from "lucide-react";

interface ScanResult {
  objects_found: string[];
  people_count: number;
  flags: string[];
}

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  wsRef: React.RefObject<WebSocket | null>;
  onComplete: (clean: boolean) => void;
}

const SCAN_DURATION = 10; // seconds
const FORBIDDEN_OBJECT_WORDS = ["cell phone", "phone", "tablet", "remote"];

export function EnvironmentScan({ videoRef, wsRef, onComplete }: Props) {
  const [phase, setPhase] = useState<"intro"|"scanning"|"done">("intro");
  const [timeLeft, setTimeLeft] = useState(SCAN_DURATION);
  const [detections, setDetections] = useState<string[]>([]);
  const [violations, setViolations] = useState<string[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
    const [scanResponses, setScanResponses] = useState(0);
  const intervalRef = useRef<any>(null);
  const frameIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Set up local video when stream is available
  useEffect(() => {
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(err => console.error("Video play error:", err));
    }
  }, [stream]);

  // Get stream from parent when scanning starts
  useEffect(() => {
    if (phase === "scanning" && videoRef.current && videoRef.current.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream;
      console.log("EnvironmentScan: Got stream from parent", mediaStream.getTracks());
      setStream(mediaStream);
    }
  }, [phase, videoRef]);

  const startScan = () => {
    setDetections([]);
    setViolations([]);
    setPhase("scanning");
    setTimeLeft(SCAN_DURATION);
    setDetections([]);
    setViolations([]);
    setScanResponses(0);

    // Countdown
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          clearInterval(frameIntervalRef.current);
          setPhase("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // Send frames for scanning
    frameIntervalRef.current = setInterval(() => {
      if (!canvasRef.current || !videoRef.current || !wsRef.current) return;
      if (wsRef.current.readyState !== 1) return;
      if (videoRef.current.readyState < 2) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const frame = canvasRef.current.toDataURL("image/jpeg", 0.6).split(",")[1];
      wsRef.current.send(JSON.stringify({ type: "room_scan", frame }));
    }, 1000);
  };

  // Listen for scan results from WS
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "scan_result") {
          setScanResponses((c) => c + 1);
          if (msg.objects_found?.length) setDetections((d) => Array.from(new Set([...d, ...msg.objects_found])));
          if (msg.flags?.length) setViolations((v) => Array.from(new Set([...v, ...msg.flags])));
          const hasForbiddenObject = (msg.objects_found || []).some((obj: string) =>
            FORBIDDEN_OBJECT_WORDS.some((w) => String(obj).toLowerCase().includes(w))
          );
          if (hasForbiddenObject) {
            setViolations((v) => Array.from(new Set([...v, "forbidden_object_in_room"])));
          }
        }
      } catch {}
    };
    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [wsRef]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(frameIntervalRef.current);
    };
  }, []);

  if (phase === "intro") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
        <RotateCcw className="w-14 h-14 text-violet-400" />
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Environment Scan</h2>
          <p className="text-gray-300 text-sm leading-relaxed max-w-sm">
            Slowly pan your camera around your workspace for 10 seconds.
            Make sure your desk, surroundings, and any monitors are visible.
          </p>
        </div>
        <ul className="text-sm text-gray-400 space-y-1.5 text-left max-w-xs">
          {["Show your full desk area", "Show left and right sides", "Ensure no phone is on desk", "Return camera to face position"].map((tip, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-900/40 text-violet-400 flex items-center justify-center text-xs flex-shrink-0">{i + 1}</span>
              {tip}
            </li>
          ))}
        </ul>
        <button onClick={startScan}
          className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors flex items-center gap-2">
          <Camera className="w-4 h-4" /> Start Scan
        </button>
      </div>
    );
  }

  if (phase === "scanning") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 space-y-4">
        {/* Camera Preview */}
        <div className="relative w-full max-w-md bg-black rounded-xl overflow-hidden border-2 border-violet-500" style={{ aspectRatio: '16/9' }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        </div>
        
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="44" fill="none" stroke="#374151" strokeWidth="6"/>
            <circle cx="48" cy="48" r="44" fill="none" stroke="#7c3aed" strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - timeLeft / SCAN_DURATION)}`}
              strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">{timeLeft}</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-white font-semibold mb-1">Scanning environment…</p>
          <p className="text-gray-400 text-sm">Slowly pan your camera around</p>
        </div>
        {detections.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-xl p-3 text-sm text-yellow-300 max-w-xs text-center">
            Detected: {detections.join(", ")}
          </div>
        )}
        <canvas ref={canvasRef} width={320} height={240} className="hidden" />
      </div>
    );
  }

  const forbiddenFromDetections = detections.some((obj) =>
    FORBIDDEN_OBJECT_WORDS.some((w) => String(obj).toLowerCase().includes(w))
  );
  const forbiddenFromFlags = violations.some((flag) =>
    ["cell_phone_in_room", "tablet_in_room", "forbidden_object_in_room", "cell_phone_detected"].includes(String(flag))
  );
  const scanDidNotRun = scanResponses === 0;
  const isClean = !forbiddenFromDetections && !forbiddenFromFlags && violations.length === 0 && !scanDidNotRun;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
      {isClean ? (
        <CheckCircle className="w-16 h-16 text-green-400" />
      ) : (
        <AlertTriangle className="w-16 h-16 text-yellow-400" />
      )}
      <div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isClean ? "Environment Clear" : "Issues Detected"}
        </h2>
        <p className="text-gray-400 text-sm">
          {isClean ? "No forbidden objects found. You may proceed." : "Please remove the flagged items before continuing."}
        </p>
      </div>
      {violations.length > 0 && (
        <div className="space-y-2">
          {violations.map((v, i) => (
            <div key={i} className="flex items-center gap-2 bg-red-900/20 border border-red-900/30 rounded-lg px-4 py-2 text-sm text-red-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {v.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => {
          if (isClean) {
            onComplete(true);
            return;
          }
          setPhase("intro");
        }}
        className={`font-semibold px-8 py-3 rounded-xl transition-colors text-white ${
          isClean ? "bg-green-600 hover:bg-green-500" : "bg-yellow-600 hover:bg-yellow-500"
        }`}>
        {isClean ? "Proceed to Calibration →" : "Retake Scan"}
      </button>
    </div>
  );
}
