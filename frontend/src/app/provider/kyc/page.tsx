"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ArrowRight, 
  Camera, 
  RefreshCw, 
  Lock, 
  User, 
  Phone, 
  Mail, 
  HelpCircle,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, getStoredAuthToken } from "@/store/useAuthStore";
import { useProviderStore } from "@/store/useProviderStore";
import { authFetch } from "@/lib/authFetch";

const GOVT_DOC_TYPES = [
  { id: "Aadhaar Card", label: "Aadhaar Card (12-Digit UIDAI)", placeholder: "1234 5678 9012", helper: "Enter standard 12-digit UIDAI number" },
  { id: "PAN Card", label: "PAN Card (10-Digit Alphanumeric)", placeholder: "ABCDE1234F", helper: "Enter 10-character PAN (e.g. ABCDE1234F)" },
  { id: "Driving License", label: "Driving License", placeholder: "KA22 20210001234", helper: "Enter full driving license number" },
  { id: "Voter ID Card", label: "Voter ID Card (EPIC)", placeholder: "ABC1234567", helper: "Enter Election Commission EPIC number" },
  { id: "Passport", label: "Passport", placeholder: "A1234567", helper: "Enter 8-digit Indian passport number" },
];

export default function ProviderKycPage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const { profile, fetchProviderKyc } = useProviderStore();

  useEffect(() => {
    router.replace("/provider/ekyc");
  }, [router]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showFormOverride, setShowFormOverride] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("Aadhaar Card");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentPhoto, setDocumentPhoto] = useState<string>("");
  const [documentFileName, setDocumentFileName] = useState<string>("");
  const [uploadingFile, setUploadingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing KYC status on mount
  useEffect(() => {
    let isMounted = true;
    async function loadKyc() {
      try {
        setLoading(true);
        const token = currentUser?.token || getStoredAuthToken();
        const headers: Record<string, string> = {};
        if (currentUser?.id) headers["x-user-id"] = currentUser.id;
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await authFetch("/api/provider/kyc", {
          headers,
          credentials: "include",
          cache: "no-store"
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.kyc && isMounted) {
            if (data.kyc.name) setFullName(data.kyc.name);
            if (data.kyc.kycDocumentType) setDocumentType(data.kyc.kycDocumentType);
            if (data.kyc.kycDocumentPhoto) setDocumentPhoto(data.kyc.kycDocumentPhoto);
          }
        }
      } catch (err) {
        console.warn("Could not load provider KYC details:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (currentUser?.id) {
      setFullName(currentUser.name || profile.name || "");
      loadKyc();
      fetchProviderKyc();
    } else {
      setLoading(false);
    }

    return () => { isMounted = false; };
  }, [currentUser, profile.name, fetchProviderKyc]);

  // Handle document file upload (Base64 fallback & server attachment API)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ message: "Selected file exceeds 10MB limit. Please upload a smaller image or PDF.", isError: true });
      return;
    }

    setUploadingFile(true);
    setDocumentFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "kyc");

      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (currentUser?.id) headers["x-user-id"] = currentUser.id;

      const uploadRes = await authFetch("/api/attachments", {
        method: "POST",
        headers,
        body: formData
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          setDocumentPhoto(uploadData.url);
          setUploadingFile(false);
          return;
        }
      }

      // Fallback: Read as base64 data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setDocumentPhoto(base64);
        setUploadingFile(false);
      };
      reader.onerror = () => {
        setFeedback({ message: "Failed to read local file.", isError: true });
        setUploadingFile(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.warn("Attachment upload fallback to base64:", err?.message || err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setDocumentPhoto(base64);
        setUploadingFile(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Format document number according to selected type
  const handleDocNumberChange = (raw: string) => {
    if (documentType === "Aadhaar Card") {
      const clean = raw.replace(/\D/g, "").slice(0, 12);
      const parts = clean.match(/.{1,4}/g);
      setDocumentNumber(parts ? parts.join(" ") : clean);
    } else if (documentType === "PAN Card") {
      setDocumentNumber(raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
    } else {
      setDocumentNumber(raw.toUpperCase().slice(0, 30));
    }
  };

  // Submit KYC form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Validation
    if (!documentNumber.trim()) {
      setFeedback({ message: "Please provide your Government ID / Document Number.", isError: true });
      return;
    }

    if (documentType === "Aadhaar Card") {
      const cleanAadhaar = documentNumber.replace(/\s/g, "");
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        setFeedback({ message: "Invalid Aadhaar format. Please provide a valid 12-digit Aadhaar number.", isError: true });
        return;
      }
    } else if (documentType === "PAN Card") {
      const cleanPan = documentNumber.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        setFeedback({ message: "Invalid PAN format. Please provide a valid 10-character PAN (e.g. ABCDE1234F).", isError: true });
        return;
      }
    }

    if (!documentPhoto) {
      setFeedback({ message: "Please upload a photo or scan of your Government Document.", isError: true });
      return;
    }

    setSubmitting(true);

    try {
      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (currentUser?.id) headers["x-user-id"] = currentUser.id;

      const res = await authFetch("/api/provider/kyc", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          fullName: fullName.trim(),
          documentType,
          documentNumber: documentNumber.trim(),
          documentPhoto,
          providerId: currentUser?.id
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setFeedback({
          message: "KYC documents submitted successfully! Your application is now under review by the BelConnect team.",
          isError: false
        });
        setShowFormOverride(false);
        setDocumentNumber("");
        await fetchProviderKyc();
      } else {
        setFeedback({ message: data.error || "Failed to submit KYC details. Please check your information.", isError: true });
      }
    } catch (err: any) {
      setFeedback({ message: err?.message || "An unexpected error occurred while submitting KYC.", isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  const isVerified = profile.isVerified || profile.verificationStatus === "verified";
  const isPending = !isVerified && (profile.verificationStatus === "pending" || profile.kycStatus === "Pending");
  const isRejected = !isVerified && (profile.verificationStatus === "rejected" || profile.kycStatus === "Rejected");

  const shouldShowForm = showFormOverride || (!isVerified && !isPending);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-muted-foreground">Checking provider verification status...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Identity & Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Compulsory KYC Identity Verification
          </h1>
          <p className="text-sm sm:text-base text-blue-100 max-w-2xl leading-relaxed">
            To protect customers and comply with Belagavi local safety guidelines, all service providers must verify their government identity before going online and accepting bookings.
          </p>
        </div>

        {/* Decorative background shapes */}
        <div className="absolute right-[-40px] top-[-40px] w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-[30%] bottom-[-50px] w-48 h-48 bg-blue-400/10 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* Dynamic Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
          feedback.isError 
            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200" 
            : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
        }`}>
          {feedback.isError ? (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="text-sm font-medium flex-1">{feedback.message}</div>
          <button 
            onClick={() => setFeedback(null)} 
            className="text-xs font-bold text-muted-foreground hover:text-foreground p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* STATE 1: VERIFIED */}
      {isVerified && !showFormOverride && (
        <div className="bg-card border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">Identity Verified</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    Active
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Your government identity is approved. You have full access to all provider features.
                </p>
              </div>
            </div>

            <Link
              href="/provider"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all shrink-0"
            >
              <span>Go to Provider Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Verified Document Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Document Type</span>
              <p className="text-sm font-bold text-foreground">{profile.kycDocumentType || "Aadhaar Card"}</p>
            </div>
            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Masked ID Number</span>
              <p className="text-sm font-bold text-foreground">
                {profile.kycDocumentNumber || (profile.kycDocumentLast4 ? `XXXX-XXXX-${profile.kycDocumentLast4}` : "Verified Document")}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Trust & Verification</span>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Verified Professional
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Need to update expired documents or change details?</span>
            <button
              onClick={() => setShowFormOverride(true)}
              className="font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Update Documents</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE 2: PENDING REVIEW */}
      {isPending && !showFormOverride && (
        <div className="bg-card border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">KYC Documents Under Review</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-500/30">
                    Review In Progress
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Your identity verification documents have been received and are being processed by BelConnect Admin.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFormOverride(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs transition-all shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-upload Documents</span>
            </button>
          </div>

          {/* Submission Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Submitted Document</span>
              <p className="text-sm font-bold text-foreground">{profile.kycDocumentType || "Government Document"}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {profile.kycDocumentNumber || (profile.kycDocumentLast4 ? `XXXX-XXXX-${profile.kycDocumentLast4}` : "Document on file")}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Estimated Turnaround</span>
              <p className="text-sm font-bold text-foreground">2 to 24 Business Hours</p>
              <p className="text-xs text-muted-foreground">You will be notified via SMS/email upon activation.</p>
            </div>
          </div>

          {/* Notice Box */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Operational Restriction Notice:</span>
            </div>
            <p className="leading-relaxed">
              While your KYC is under review, you cannot turn your availability status to online or receive new customer job bookings. As soon as an administrator approves your verification in the admin console, your account will be activated automatically with zero additional steps.
            </p>
          </div>
        </div>
      )}

      {/* STATE 3: UNVERIFIED / REJECTED / FORM INPUT */}
      {shouldShowForm && (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Form Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-5">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <span>{isRejected ? "Resubmit KYC Verification" : "Submit Government Identity"}</span>
                {isRejected && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-xs font-bold border border-rose-500/20">
                    Previous Submission Rejected
                  </span>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Fill in your government ID details. In compliance with DPDP regulations, only the last 4 digits are saved.
              </p>
            </div>

            {showFormOverride && (
              <button
                type="button"
                onClick={() => setShowFormOverride(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold px-3 py-1.5 rounded-xl border border-border hover:bg-muted"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Stepper overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">Step 1</span>
              <p className="text-xs font-bold text-foreground">Full Name & Details</p>
              <p className="text-[11px] text-muted-foreground">Match the name on your government card</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">Step 2</span>
              <p className="text-xs font-bold text-foreground">Document Number</p>
              <p className="text-[11px] text-muted-foreground">Aadhaar, PAN, Voter ID, or License</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">Step 3</span>
              <p className="text-xs font-bold text-foreground">Upload Document Photo</p>
              <p className="text-[11px] text-muted-foreground">Clear front side image or PDF scan</p>
            </div>
          </div>

          {/* KYC Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Full Legal Name (as printed on your Government ID)</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Kumar Patil"
                className="w-full px-4 py-3 rounded-2xl bg-muted/30 border border-border focus:bg-background focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 text-sm outline-none transition-all text-foreground"
              />
            </div>

            {/* Document Type Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Select Government ID Type</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={documentType}
                onChange={(e) => {
                  setDocumentType(e.target.value);
                  setDocumentNumber("");
                }}
                className="w-full px-4 py-3 rounded-2xl bg-muted/30 border border-border focus:bg-background focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 text-sm outline-none transition-all text-foreground"
              >
                {GOVT_DOC_TYPES.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Number Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Document / ID Number</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {GOVT_DOC_TYPES.find((d) => d.id === documentType)?.helper}
                </span>
              </label>
              <input
                type="text"
                required
                value={documentNumber}
                onChange={(e) => handleDocNumberChange(e.target.value)}
                placeholder={GOVT_DOC_TYPES.find((d) => d.id === documentType)?.placeholder || "Enter document number"}
                className="w-full px-4 py-3 rounded-2xl bg-muted/30 border border-border focus:bg-background focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 text-sm font-mono tracking-wider outline-none transition-all text-foreground uppercase"
              />
            </div>

            {/* Document Photo / File Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Upload Document Photo / Scan (Front Side)</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">JPG, PNG, WEBP or PDF (Max 10MB)</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {documentPhoto ? (
                <div className="relative p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row items-center gap-4">
                  {documentPhoto.startsWith("data:application/pdf") || documentPhoto.endsWith(".pdf") ? (
                    <div className="w-16 h-16 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                      <FileText className="w-8 h-8" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-border shrink-0 bg-muted">
                      <img src={documentPhoto} alt="KYC Document Preview" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <p className="text-xs font-bold text-foreground flex items-center justify-center sm:justify-start gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Document Attached Successfully</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-sm">
                      {documentFileName || "Identity document ready for verification review"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-all"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDocumentPhoto("");
                        setDocumentFileName("");
                      }}
                      className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border hover:border-blue-500 rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all hover:bg-blue-500/5 flex flex-col items-center justify-center space-y-2 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground group-hover:text-blue-600 group-hover:bg-blue-500/10 transition-all">
                    {uploadingFile ? (
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    {uploadingFile ? "Processing Document..." : "Click to Upload Document Photo or Scan"}
                  </div>
                  <p className="text-[11px] text-muted-foreground max-w-xs">
                    Please ensure that your name, date of birth, and identity number are clearly legible and not blurred.
                  </p>
                </div>
              )}
            </div>

            {/* Privacy Compliance Callout */}
            <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-xs text-muted-foreground flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-foreground block">
                  Indian Digital Privacy & Data Security Protection
                </span>
                <p className="text-[11px] leading-relaxed">
                  BelConnect complies with Digital Personal Data Protection standards. We store ONLY the last 4 digits (e.g. XXXX-XXXX-1234) in the database. Full numbers are never saved or made public. Your document is used strictly for one-time verification.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="submit"
                disabled={submitting || uploadingFile}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting KYC Verification...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Submit Documents for Verification</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Support & FAQ Footer Card */}
      <div className="p-5 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-foreground">Need help with KYC Verification?</p>
            <p className="text-[11px]">Contact BelConnect Partner Support at +91 98765 43210 or email support@belconnect.in</p>
          </div>
        </div>

        <Link
          href="/help"
          className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted font-semibold text-foreground transition-all shrink-0"
        >
          Partner FAQ & Guides
        </Link>
      </div>
    </div>
  );
}

