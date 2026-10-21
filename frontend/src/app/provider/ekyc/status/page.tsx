"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getStoredAuthToken } from "@/store/useAuthStore";
import { authFetch } from "@/lib/authFetch";
import { 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ArrowRight, 
  FileText, 
  CheckCircle2, 
  Lock, 
  ExternalLink,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface KycStatusData {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACTION_REQUIRED" | "APPROVED" | "REJECTED";
  currentStep: number;
  rejectionReason: string | null;
  actionNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  documentType: string;
  maskedNumber: string | null;
  documentPhoto: string | null;
  selfiePhoto: string | null;
  livenessScore: number | null;
}

export default function ProviderEkycStatusPage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [kycData, setKycData] = useState<KycStatusData | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const fetchStatus = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await authFetch("/api/ekyc/status", { headers });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsVerified(data.isVerified);
        setKycData(data.kyc);

        // If approved, redirect automatically to Screen 6 (success)
        if (data.isVerified || data.kyc?.status === "APPROVED") {
          router.push("/provider/ekyc/success");
        }
      } else {
        setError(data.error || "Failed to load verification status.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading verification status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, router]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center mx-auto animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-xs text-muted-foreground font-semibold">
          Retrieving real-time eKYC verification status...
        </p>
      </div>
    );
  }

  const status = kycData?.status || "UNDER_REVIEW";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Status Shield Hero */}
        <div className="text-center space-y-3">
          {status === "UNDER_REVIEW" || status === "SUBMITTED" ? (
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
          ) : status === "ACTION_REQUIRED" ? (
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
          ) : status === "REJECTED" ? (
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
              <XCircle className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
          )}

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              {status === "UNDER_REVIEW" || status === "SUBMITTED" ? (
                <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 px-3 py-0.5 rounded-full border border-amber-500/20">
                  Verification Under Review
                </span>
              ) : status === "ACTION_REQUIRED" ? (
                <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 px-3 py-0.5 rounded-full border border-amber-500/20">
                  Action Required
                </span>
              ) : status === "REJECTED" ? (
                <span className="bg-rose-500/15 text-rose-600 dark:text-rose-400 px-3 py-0.5 rounded-full border border-rose-500/20">
                  Application Rejected
                </span>
              ) : (
                <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-3 py-0.5 rounded-full border border-emerald-500/20">
                  Identity Verified
                </span>
              )}
            </div>

            <h2 className="text-2xl font-black text-foreground tracking-tight">
              {status === "UNDER_REVIEW" || status === "SUBMITTED"
                ? "Your eKYC is Being Reviewed"
                : status === "ACTION_REQUIRED"
                ? "Document Correction Needed"
                : status === "REJECTED"
                ? "Verification Not Approved"
                : "Identity Verified"}
            </h2>

            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
              {status === "UNDER_REVIEW" || status === "SUBMITTED"
                ? "Our compliance officers are verifying your submitted identity document and facial liveness. Average review turnaround is between 2 to 24 business hours."
                : status === "ACTION_REQUIRED"
                ? "Our review team identified an issue with your submitted documents. Please check the guidance below and re-upload."
                : status === "REJECTED"
                ? "Your identity verification could not be approved due to compliance restrictions. See administrator feedback below."
                : "Congratulations! Your account has been verified and your profile is live for customer bookings."}
            </p>
          </div>
        </div>

        {/* Action Required / Rejection Feedback Box */}
        {(status === "ACTION_REQUIRED" || status === "REJECTED") && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Compliance Team Notes:</span>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 pl-6">
              {kycData?.actionNotes || kycData?.rejectionReason || "Please ensure your government ID is clear, fully visible without glares, and your selfie matches your official identity document."}
            </p>
            <div className="pt-2 pl-6">
              <button
                type="button"
                onClick={() => router.push("/provider/ekyc/document")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                <span>Re-upload Documents</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Application Details Summary */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 divide-y divide-border/60">
          <div className="pb-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Document Submitted</span>
            <span className="font-bold text-foreground">
              {kycData?.documentType || "Aadhaar Card"}
            </span>
          </div>

          <div className="py-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Masked Identifier</span>
            <span className="font-mono font-bold text-foreground">
              {kycData?.maskedNumber || "XXXX-XXXX-••••"}
            </span>
          </div>

          <div className="py-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Submitted On</span>
            <span className="font-medium text-foreground">
              {kycData?.submittedAt
                ? new Date(kycData.submittedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })
                : "Just now"}
            </span>
          </div>

          <div className="py-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Liveness Integrity</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {kycData?.livenessScore ? `${kycData.livenessScore}% Score` : "Verified Live"}
            </span>
          </div>

          <div className="pt-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Expected Verification SLA</span>
            <span className="font-bold text-blue-600">2 – 24 Business Hours</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
            <span>{refreshing ? "Checking Status..." : "Refresh Status"}</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/provider")}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <span>Go to Provider Home</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Security & Support Guarantee */}
        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>
            Need urgent assistance? Contact BelConnect Partner Support at{" "}
            <a href="mailto:support@belconnect.com" className="text-blue-600 underline font-semibold">
              support@belconnect.com
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

