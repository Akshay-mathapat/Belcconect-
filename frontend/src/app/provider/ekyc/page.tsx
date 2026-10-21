"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  AlertCircle,
  Clock,
  Sparkles,
  Info
} from "lucide-react";
import Link from "next/link";
import { EkycStepperHeader } from "@/components/provider/ekyc/EkycStepperHeader";
import { useAuthStore, getStoredAuthToken } from "@/store/useAuthStore";
import { authFetch } from "@/lib/authFetch";

const DOCUMENT_OPTIONS = [
  {
    id: "Aadhaar Card",
    name: "Aadhaar Card",
    desc: "12-digit UIDAI identity with offline cryptographic verification",
    badge: "Fastest • Recommended",
    icon: ShieldCheck,
  },
  {
    id: "PAN Card",
    name: "PAN Card",
    desc: "10-character alphanumeric NSDL/Income Tax department card",
    badge: "Official Tax ID",
    icon: FileText,
  },
  {
    id: "Driving License",
    name: "Driving License",
    desc: "Ministry of Road Transport (MoRTH) smart card license",
    badge: "Valid ID",
    icon: FileText,
  },
  {
    id: "Voter ID Card",
    name: "Voter ID Card (EPIC)",
    desc: "Election Commission of India photographic identity card",
    badge: "Standard",
    icon: FileText,
  },
];

export default function EkycSelectDocumentPage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [selectedDoc, setSelectedDoc] = useState<string>("Aadhaar Card");
  const [consentAgreed, setConsentAgreed] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

  useEffect(() => {
    async function checkExistingKyc() {
      try {
        setLoading(true);
        const token = currentUser?.token || getStoredAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await authFetch("/api/ekyc/me", { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.isVerified || data.kyc?.status === "APPROVED") {
            router.replace("/provider/ekyc/success");
            return;
          }
          if (data.kyc?.status === "UNDER_REVIEW") {
            setExistingStatus("UNDER_REVIEW");
          }
          if (data.kyc?.document?.document_type) {
            setSelectedDoc(data.kyc.document.document_type);
          }
        }
      } catch (err) {
        console.warn("Could not check existing eKYC status:", err);
      } finally {
        setLoading(false);
      }
    }

    if (currentUser) {
      checkExistingKyc();
    } else {
      setLoading(false);
    }
  }, [currentUser, router]);

  const handleStartVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!consentAgreed) {
      setErrorMessage("Please accept the statutory data privacy and verification consent to proceed.");
      return;
    }

    setSubmitting(true);
    try {
      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await authFetch("/api/ekyc/start", {
        method: "POST",
        headers,
        body: JSON.stringify({
          documentType: selectedDoc,
          consentText: "I explicitly consent to BelConnect collecting and verifying my government identity documents and live facial selfie solely for provider onboarding, trust & safety validation under India DPDP statutory provisions."
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Save selected document in sessionStorage for step continuity
        if (typeof window !== "undefined") {
          sessionStorage.setItem("ekyc_selected_doc", selectedDoc);
        }
        router.push("/provider/ekyc/document");
      } else {
        setErrorMessage(data.error || "Failed to initialize eKYC session. Please try again.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected network error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-muted-foreground">Checking verification status...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <EkycStepperHeader currentStep={1} />

      {/* Review in progress banner if already submitted */}
      {existingStatus === "UNDER_REVIEW" && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
            <span className="font-bold">You have an eKYC application currently under review.</span>
          </div>
          <Link
            href="/provider/ekyc/status"
            className="px-3 py-1 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-all shrink-0"
          >
            View Status
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Card Form */}
      <form onSubmit={handleStartVerification} className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">Select Government Identity Document</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Choose the official identity proof you wish to verify. Your document will be inspected along with a live selfie.
          </p>
        </div>

        {/* Radio Option Cards */}
        <div className="space-y-3">
          {DOCUMENT_OPTIONS.map((doc) => {
            const isSelected = selectedDoc === doc.id;
            const Icon = doc.icon;

            return (
              <label
                key={doc.id}
                onClick={() => setSelectedDoc(doc.id)}
                className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="documentType"
                  value={doc.id}
                  checked={isSelected}
                  onChange={() => setSelectedDoc(doc.id)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-600 border-border"
                />

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{doc.name}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {doc.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{doc.desc}</p>
                </div>
              </label>
            );
          })}
        </div>

        {/* DPDP Statutory Privacy Notice */}
        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-xs text-muted-foreground space-y-3">
          <div className="flex items-center gap-2 text-foreground font-bold">
            <Lock className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Digital Personal Data Protection (DPDP) Compliance</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            BelConnect adheres to the Digital Personal Data Protection Act 2023. We store <strong>only masked numbers (last 4 digits)</strong>. Original document images are saved in private object storage with end-to-end access control and are exclusively reviewed by verified administrators.
          </p>

          <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              required
              checked={consentAgreed}
              onChange={(e) => setConsentAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-600 border-border"
            />
            <span className="text-xs font-semibold text-foreground">
              I authorize BelConnect to verify my government document and live selfie for provider onboarding and safety verification.
            </span>
          </label>
        </div>

        {/* Continue Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !consentAgreed}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-blue-600/25 transition-all cursor-pointer"
          >
            {submitting ? (
              <span>Initializing eKYC Session...</span>
            ) : (
              <>
                <span>Continue to Document Details</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

