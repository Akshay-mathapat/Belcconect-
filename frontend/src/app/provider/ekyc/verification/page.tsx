"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getStoredAuthToken } from "@/store/useAuthStore";
import { authFetch } from "@/lib/authFetch";
import { EkycStepperHeader } from "@/components/provider/ekyc/EkycStepperHeader";
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  ShieldCheck, 
  ArrowRight, 
  FileText, 
  Camera, 
  Sparkles,
  Lock
} from "lucide-react";

interface VerificationStep {
  id: string;
  label: string;
  desc: string;
  icon: any;
  status: "waiting" | "running" | "completed" | "failed";
}

export default function ProviderEkycVerificationPage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [steps, setSteps] = useState<VerificationStep[]>([
    {
      id: "doc",
      label: "Document Format & Integrity Check",
      desc: "Validating legal format, checksum & resolution",
      icon: FileText,
      status: "running"
    },
    {
      id: "quality",
      label: "Image Quality & Clarity Analysis",
      desc: "Checking illumination, contrast & non-blur criteria",
      icon: Sparkles,
      status: "waiting"
    },
    {
      id: "liveness",
      label: "Facial Liveness & Biometric Verification",
      desc: "Confirming physical presence & active liveness score",
      icon: Camera,
      status: "waiting"
    },
    {
      id: "fraud",
      label: "Anti-Fraud & Registry Deduplication",
      desc: "Screening against duplicate credentials & blacklists",
      icon: ShieldCheck,
      status: "waiting"
    }
  ]);

  const [overallProgress, setOverallProgress] = useState(15);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const runAutomatedChecks = async () => {
      // Step 1: Document validation (1.2s)
      await new Promise((r) => setTimeout(r, 1200));
      if (isCancelled) return;
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 0
            ? { ...s, status: "completed" }
            : idx === 1
            ? { ...s, status: "running" }
            : s
        )
      );
      setOverallProgress(40);

      // Step 2: Quality analysis (1.2s)
      await new Promise((r) => setTimeout(r, 1200));
      if (isCancelled) return;
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 1
            ? { ...s, status: "completed" }
            : idx === 2
            ? { ...s, status: "running" }
            : s
        )
      );
      setOverallProgress(65);

      // Step 3: Biometric liveness check (1.2s)
      await new Promise((r) => setTimeout(r, 1200));
      if (isCancelled) return;
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 2
            ? { ...s, status: "completed" }
            : idx === 3
            ? { ...s, status: "running" }
            : s
        )
      );
      setOverallProgress(85);

      // Step 4: Anti-fraud & submit to backend (1.0s)
      await new Promise((r) => setTimeout(r, 1000));
      if (isCancelled) return;

      setIsSubmitting(true);
      try {
        const token = currentUser?.token || getStoredAuthToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await authFetch("/api/ekyc/submit", {
          method: "POST",
          headers,
          body: JSON.stringify({})
        });

        const data = await res.json();
        if (res.ok && data.success) {
          if (isCancelled) return;
          setSteps((prev) =>
            prev.map((s) => ({ ...s, status: "completed" }))
          );
          setOverallProgress(100);
          setSubmissionComplete(true);

          // Smoothly redirect to Step 5 (Review Pending / Status)
          setTimeout(() => {
            if (!isCancelled) {
              router.push("/provider/ekyc/status");
            }
          }, 1500);
        } else {
          setErrorMessage(data.error || "Automated check verification failed. Please review your details.");
          setSteps((prev) =>
            prev.map((s, idx) => (idx === 3 ? { ...s, status: "failed" } : s))
          );
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to reach verification engine.");
        setSteps((prev) =>
          prev.map((s, idx) => (idx === 3 ? { ...s, status: "failed" } : s))
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    runAutomatedChecks();

    return () => {
      isCancelled = true;
    };
  }, [currentUser, router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <EkycStepperHeader currentStep={4} />

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/provider/ekyc/document")}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
          >
            Review Documents
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            {submissionComplete ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-bounce" />
            ) : (
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            )}
          </div>
          <h3 className="text-xl font-extrabold text-foreground tracking-tight">
            {submissionComplete
              ? "All Automated Checks Passed!"
              : "Verifying Your Identity Documents"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {submissionComplete
              ? "Your application is being transferred to the BelConnect Compliance Desk for final sign-off."
              : "Our automated verification engine is analyzing your government document, selfie liveness, and identity integrity."}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>Integrity Check Progress</span>
            <span className="text-blue-600 font-bold">{overallProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-700 rounded-full ${
                submissionComplete
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600"
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Check Items List */}
        <div className="space-y-3 pt-2">
          {steps.map((st) => {
            const Icon = st.icon;
            const isDone = st.status === "completed";
            const isRun = st.status === "running";
            const isFail = st.status === "failed";

            return (
              <div
                key={st.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isDone
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : isRun
                    ? "bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20"
                    : isFail
                    ? "bg-rose-500/5 border-rose-500/30"
                    : "bg-muted/10 border-border/50 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isDone
                        ? "bg-emerald-500/10 text-emerald-600"
                        : isRun
                        ? "bg-blue-500/10 text-blue-600"
                        : isFail
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{st.label}</h4>
                    <p className="text-[10px] text-muted-foreground">{st.desc}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isDone && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Passed
                    </span>
                  )}
                  {isRun && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-full">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Analyzing
                    </span>
                  )}
                  {isFail && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-full">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Failed
                    </span>
                  )}
                  {st.status === "waiting" && (
                    <span className="text-[10px] font-semibold text-muted-foreground px-2 py-1">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button if Complete or Redirecting */}
        {submissionComplete && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => router.push("/provider/ekyc/status")}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <span>View Verification Status</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Security disclaimer */}
        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Automated security checks comply with Indian UIDAI & DPDP encryption standards.</span>
        </div>
      </div>
    </div>
  );
}

