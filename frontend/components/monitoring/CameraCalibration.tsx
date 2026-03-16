"use client";
/**
 * CameraCalibration.tsx
 * ─────────────────────
 * Guides the candidate through the 4-corner calibration sequence.
 * Shows a bright marker at each corner of the screen in turn.
 * Captures the candidate's gaze vector at each corner via the backend.
 * Once complete, the homography matrix is sent to GazeAgent.
 *
 * This is the key novel technique: by mapping gaze→screen corners,
 * the backend can later detect when the candidate looks BELOW the screen
 * (i.e. at a phone on the desk) even if the phone is not visible.
 */
import { useState, useRef, useEffect } from "react";
import { CheckCircle, Camera, AlertCircle } from "lucide-react";

const CORNERS = [
  { id: "tl", label: "Top Left",     style: "top-4 left-4" },
  { id: "tr", label: "Top Right",    style: "top-4 right-4" },
  { id: "bl", label: "Bottom Left",  style: "bottom-4 left-4" },
  { id: "br", label: "Bottom Right", style: "bottom-4 right-4" },
];

interface Props {
  sessionId: number;
  wsRef: React.RefObject<WebSocket | null>;
  onComplete: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

export function CameraCalibration({ sessionId, wsRef, onComplete, videoRef }: Props) {
  const [step, setStep] = useState(-1);         // -1 = intro, 0-3 = corners, 4 = done
  const [countdown, setCountdown] = useState(3);
  const [capturing, setCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const completionRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentCorner = step >= 0 && step < 4 ? CORNERS[step] : null;

  // Set up local video when stream is available
  useEffect(() => {
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(err => console.error("Video play error:", err));
    }
  }, [stream]);

  // Get stream from parent when calibration starts
  useEffect(() => {
    if (step === 0 && videoRef && videoRef.current && videoRef.current.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream;
      console.log("CameraCalibration: Got stream from parent", mediaStream.getTracks());
      setStream(mediaStream);
    }
  }, [step, videoRef]);

  const startCalibration = () => {
    setStep(0);
  };

  const waitForCalibrationAck = (expectedCorner: number) => {
    return new Promise<boolean>((resolve) => {
      const ws = wsRef.current;
      if (!ws) {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        ws.removeEventListener("message", handler);
        resolve(false);
      }, 2500);

      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "calibration_result" && msg.corner_index === expectedCorner) {
            clearTimeout(timeout);
            ws.removeEventListener("message", handler);
            resolve(true);
          }
        } catch {}
      };

      ws.addEventListener("message", handler);
    });
  };

  const sendCalibrationCapture = async (cornerStep: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return false;

    let frame: string | undefined;
    const sourceVideo = localVideoRef.current || videoRef?.current;
    if (canvasRef.current && sourceVideo) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.drawImage(sourceVideo, 0, 0, 320, 240);
        frame = canvasRef.current.toDataURL("image/jpeg", 0.7).split(",")[1];
      }
    }

    const expectedCorner = cornerStep + 1;
    ws.send(JSON.stringify({
      type: "calibration_capture",
      corner_index: cornerStep,
      frame,
    }));

    return await waitForCalibrationAck(expectedCorner);
  };

  const captureCorner = () => {
    if (capturing) return;
    setCapturing(true);
    setCountdown(3);

    // Count down 3 seconds while candidate holds gaze on corner
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          setTimeout(async () => {
            const ack = await sendCalibrationCapture(step);
            if (!ack) {
              setCapturing(false);
              setCountdown(3);
              return;
            }
            setCapturing(false);
            if (step >= 3) {
              setStep(4);
            } else {
              setStep((s) => s + 1);
            }
          }, 400);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (step !== 4) return;
    completionRef.current = setTimeout(() => {
      onComplete();
    }, 1200);
    return () => clearTimeout(completionRef.current);
  }, [step, onComplete]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(completionRef.current);
    };
  }, []);

  if (step === 4) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Calibration Complete</h2>
        <p className="text-gray-400 text-sm">Camera calibrated. Off-frame gaze detection is now active.</p>
      </div>
    );
  }

  if (step === -1) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
        <Camera className="w-14 h-14 text-violet-400" />
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Camera Calibration</h2>
          <p className="text-gray-300 text-sm leading-relaxed max-w-sm">
            We'll show a marker at each corner of your screen. Look directly at each marker and hold for 3 seconds.
            This helps detect if you look away during the exam.
          </p>
        </div>
        <div className="bg-violet-900/20 border border-violet-800/30 rounded-xl p-4 max-w-sm text-sm text-violet-300">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Make sure your face is visible in the webcam before starting.
        </div>
        <button onClick={startCalibration}
          className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
          Start Calibration
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-950">
      {/* Camera Preview in background */}
      <div className="absolute inset-0">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover opacity-30"
          onLoadedMetadata={() => console.log("CameraCalibration: Video metadata loaded")}
          onPlay={() => console.log("CameraCalibration: Video playing")}
        />
      </div>
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />
      
      {/* Corner markers — show only current */}
      {CORNERS.map((corner, i) => (
        <div key={corner.id}
          className={`absolute ${corner.style} w-16 h-16 flex items-center justify-center transition-all duration-300 ${
            i === step ? "opacity-100 scale-100" : i < step ? "opacity-30 scale-75" : "opacity-0 scale-75"
          }`}>
          <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center ${
            i < step ? "border-green-500 bg-green-900/30" :
            i === step ? "border-white bg-white/10 animate-pulse" : "border-gray-600"
          }`}>
            {i < step ? <CheckCircle className="w-6 h-6 text-green-400" /> :
             i === step ? <div className="w-4 h-4 bg-white rounded-full" /> : null}
          </div>
        </div>
      ))}

      {/* Instructions overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-gray-900/90 border border-gray-700 rounded-2xl p-8 text-center max-w-sm backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-sm text-gray-400 font-medium">
              Corner {step + 1} of 4
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Look at {currentCorner?.label}
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            Look at the glowing white circle in the {currentCorner?.label?.toLowerCase()} corner of your screen.
          </p>

          {capturing ? (
            <div className="space-y-3">
              <div className="text-5xl font-bold text-violet-400">{countdown}</div>
              <p className="text-gray-400 text-sm">Hold your gaze…</p>
            </div>
          ) : (
            <button onClick={captureCorner}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
              I'm looking at it →
            </button>
          )}

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-6">
            {CORNERS.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
                i < step ? "bg-green-400" : i === step ? "bg-violet-400" : "bg-gray-700"
              }`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
