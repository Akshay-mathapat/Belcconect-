"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  FileText, 
  ArrowRight, 
  ArrowLeft, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Camera, 
  X, 
  RefreshCw,
  User
} from "lucide-react";
import { EkycStepperHeader } from "@/components/provider/ekyc/EkycStepperHeader";
import { useAuthStore, getStoredAuthToken } from "@/store/useAuthStore";
import { authFetch } from "@/lib/authFetch";

export default function EkycDocumentPage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [documentType, setDocumentType] = useState<string>("Aadhaar Card");
  const [fullName, setFullName] = useState<string>("");
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [documentPhoto, setDocumentPhoto] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize from session or backend
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDoc = sessionStorage.getItem("ekyc_selected_doc");
      if (savedDoc) setDocumentType(savedDoc);
    }

    if (currentUser?.name) {
      setFullName(currentUser.name);
    }

    async function loadSavedData() {
      try {
        const token = currentUser?.token || getStoredAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await authFetch("/api/ekyc/me", { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.name) setFullName(data.name);
          if (data.kyc?.document?.document_type) setDocumentType(data.kyc.document.document_type);
          if (data.kyc?.document?.document_photo_url) setDocumentPhoto(data.kyc.document.document_photo_url);
        }
      } catch (err) {
        console.warn("Could not load saved document details:", err);
      }
    }

    if (currentUser) {
      loadSavedData();
    }
  }, [currentUser]);

  // Format document number according to type
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

  // Handle file / photo upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Selected file exceeds 10MB limit. Please upload a smaller image or PDF.");
      return;
    }

    setUploading(true);
    setFileName(file.name);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "kyc");

      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await authFetch("/api/attachments", {
        method: "POST",
        headers,
        body: formData
      });

      if (res.ok) {
        const uploadData = await res.json();
        if (uploadData.url) {
          setDocumentPhoto(uploadData.url);
          setUploading(false);
          return;
        }
      }

      // Fallback: Read as base64 data URI
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentPhoto(event.target?.result as string);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentPhoto(event.target?.result as string);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!fullName.trim()) {
      setErrorMessage("Please enter your Full Legal Name as printed on your document.");
      return;
    }

    if (!documentNumber.trim()) {
      setErrorMessage("Please enter your Government Document Number.");
      return;
    }

    if (documentType === "Aadhaar Card") {
      const cleanAadhaar = documentNumber.replace(/\s/g, "");
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        setErrorMessage("Please enter a valid 12-digit Aadhaar number (e.g. 1234 5678 9012).");
        return;
      }
    } else if (documentType === "PAN Card") {
      const cleanPan = documentNumber.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        setErrorMessage("Please enter a valid 10-character PAN number (e.g. ABCDE1234F).");
        return;
      }
    }

    if (!documentPhoto) {
      setErrorMessage("Please upload a clear front-side photo or scan of your document.");
      return;
    }

    setSubmitting(true);
    try {
      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await authFetch("/api/ekyc/document", {
        method: "POST",
        headers,
        body: JSON.stringify({
          documentType,
          documentNumber: documentNumber.trim(),
          documentPhoto,
          fullName: fullName.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/provider/ekyc/selfie");
      } else {
        setErrorMessage(data.error || "Failed to save document details.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected network error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <EkycStepperHeader currentStep={2} />

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmitDocument} className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">Upload {documentType} Details</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Ensure details match your official government identity card. For privacy compliance, only the last 4 digits are saved.
          </p>
        </div>

        {/* Full Legal Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>Full Legal Name (as on {documentType})</span>
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

        {/* Document Number */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>{documentType} Number</span>
              <span className="text-rose-500">*</span>
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {documentType === "Aadhaar Card" ? "12 Digits (e.g. 1234 5678 9012)" : "10 Characters (e.g. ABCDE1234F)"}
            </span>
          </label>
          <input
            type="text"
            required
            value={documentNumber}
            onChange={(e) => handleDocNumberChange(e.target.value)}
            placeholder={documentType === "Aadhaar Card" ? "1234 5678 9012" : "ABCDE1234F"}
            className="w-full px-4 py-3 rounded-2xl bg-muted/30 border border-border focus:bg-background focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 text-sm font-mono tracking-wider outline-none transition-all text-foreground uppercase"
          />
        </div>

        {/* Document Front Photo Upload */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span>{documentType} Front Side Photo or Scan</span>
              <span className="text-rose-500">*</span>
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">JPG, PNG, PDF (Max 10MB)</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileUpload}
          />

          {documentPhoto ? (
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden border border-border shrink-0 bg-muted">
                {documentPhoto.includes(".pdf") || documentPhoto.startsWith("data:application/pdf") ? (
                  <div className="w-full h-full flex items-center justify-center text-rose-500 bg-rose-500/10 font-bold text-xs">
                    PDF DOC
                  </div>
                ) : (
                  <img src={documentPhoto} alt="Document Preview" className="w-full h-full object-cover" />
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1">
                <p className="text-xs font-bold text-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Document Uploaded</span>
                </p>
                <p className="text-[11px] text-muted-foreground truncate max-w-xs">
                  {fileName || "Front side document attached"}
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
                    setFileName("");
                  }}
                  className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all"
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
                {uploading ? <RefreshCw className="w-6 h-6 animate-spin text-blue-600" /> : <Upload className="w-6 h-6" />}
              </div>
              <div className="text-xs font-bold text-foreground">
                {uploading ? "Processing Document File..." : "Click to Upload Document Photo"}
              </div>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                Ensure name, photo, and number are clearly visible and not cut off.
              </p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/provider/ekyc")}
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            type="submit"
            disabled={submitting || uploading || !documentPhoto || !documentNumber}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-blue-600/25 transition-all cursor-pointer"
          >
            {submitting ? (
              <span>Saving Document...</span>
            ) : (
              <>
                <span>Proceed to Live Selfie</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

