"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Camera, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Lock,
  Sun,
  Eye,
  Smile
} from "lucide-react";
import { EkycStepperHeader } from "@/components/provider/ekyc/EkycStepperHeader";
import { useAuthStore, getStoredAuthToken } from "@/store/useAuthStore";
import { authFetch } from "@/lib/authFetch";

export default function EkycSelfiePage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [cameraPermissionError, setCameraPermissionError] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileFallbackRef = useRef<HTMLInputElement>(null);

  // Initialize camera stream
  const startCamera = async () => {
    setCameraPermissionError(false);
    setErrorMessage("");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Live camera stream is not supported in this browser environment.");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      setStream(mediaStream);
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn("Camera access warning:", err);
      setCameraActive(false);
      setCameraPermissionError(true);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Update video element when stream is ready
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Capture snapshot with 3-second countdown
  const triggerCountdownAndCapture = () => {
    if (countdown !== null) return;
    setCountdown(3);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          takeSnapshot();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontally for natural mirror feel
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/png", 0.92);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedPhoto("");
    startCamera();
  };

  // Fallback file capture for devices without web camera stream
  const handleFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedPhoto(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit selfie to backend
  const handleSubmitSelfie = async () => {
    if (!capturedPhoto) {
      setErrorMessage("Please capture a live facial selfie to proceed.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await authFetch("/api/ekyc/selfie", {
        method: "POST",
        headers,
        body: JSON.stringify({
          selfiePhoto: capturedPhoto,
          metadata: {
            source: cameraPermissionError ? "file_fallback" : "live_stream",
            capturedAt: new Date().toISOString()
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/provider/ekyc/verification");
      } else {
        setErrorMessage(data.error || "Failed to process live selfie.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected network error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <EkycStepperHeader currentStep={3} />

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">Live Facial Selfie Verification</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Capture a clear, live selfie from your device camera. This confirms your identity matches your government document.
          </p>
        </div>

        {/* Liveness guidelines pills */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
            <Sun className="w-4 h-4 text-amber-500 mx-auto" />
            <span className="text-[10px] font-bold text-foreground block">Good Lighting</span>
            <span className="text-[9px] text-muted-foreground block">Avoid shadows</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
            <Eye className="w-4 h-4 text-blue-600 mx-auto" />
            <span className="text-[10px] font-bold text-foreground block">Look Straight</span>
            <span className="text-[9px] text-muted-foreground block">Remove sunglasses</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
            <Smile className="w-4 h-4 text-emerald-600 mx-auto" />
            <span className="text-[10px] font-bold text-foreground block">Neutral Expression</span>
            <span className="text-[9px] text-muted-foreground block">Clear face view</span>
          </div>
        </div>

        {/* Camera Viewport or Captured Snapshot */}
        <div className="relative w-full max-w-sm mx-auto aspect-square rounded-3xl overflow-hidden bg-black flex items-center justify-center border-4 border-muted shadow-lg">
          {capturedPhoto ? (
            <img src={capturedPhoto} alt="Captured Selfie" className="w-full h-full object-cover" />
          ) : cameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* Oval Face Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[68%] h-[80%] rounded-[50%] border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>

              {/* Countdown overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center">
                  <span className="text-7xl font-extrabold text-white animate-ping">
                    {countdown}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-center text-white space-y-3">
              <Camera className="w-10 h-10 text-white/50 mx-auto" />
              <p className="text-xs text-white/80">Camera stream inactive or permission blocked.</p>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition-all cursor-pointer"
              >
                Enable Camera
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Fallback File Trigger */}
        <input
          ref={fileFallbackRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleFileFallback}
        />

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {capturedPhoto ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retake Photo</span>
              </button>

              <button
                type="button"
                onClick={handleSubmitSelfie}
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/25 transition-all cursor-pointer"
              >
                {submitting ? (
                  <span>Saving Live Selfie...</span>
                ) : (
                  <>
                    <span>Confirm & Run Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : cameraActive ? (
            <button
              type="button"
              onClick={triggerCountdownAndCapture}
              disabled={countdown !== null}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Camera className="w-5 h-5" />
              <span>Capture Selfie</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileFallbackRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Upload Photo from Camera</span>
            </button>
          )}
        </div>

        {/* Privacy Note */}
        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Live selfie is encrypted and checked for liveness. Never shared or sold.</span>
        </div>
      </div>
    </div>
  );
}

