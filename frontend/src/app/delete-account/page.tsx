"use client";

import { useState } from "react";
import Link from "next/link";
import Footer from "@/components/sections/Footer";
import { ShieldAlert, Trash2, CheckCircle2, AlertCircle, ArrowLeft, Lock, FileText, Clock, HelpCircle, Loader2 } from "lucide-react";
import { SITE_NAME } from "@/constants/site";

export default function DeleteAccountPage() {
  const [role, setRole] = useState<"customer" | "service_provider" | "job_provider">("customer");
  const [identifier, setIdentifier] = useState("");
  const [reason, setReason] = useState("");
  const [confirmUnderstood, setConfirmUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError("Please enter your registered email address or 10-digit mobile number.");
      return;
    }

    if (!confirmUnderstood) {
      setError("Please acknowledge that account deletion is permanent and cannot be reversed.");
      return;
    }

    try {
      setSubmitting(true);
      const isEmail = identifier.includes("@");
      const payload: any = {
        role,
        reason: reason.trim() || "User requested deletion via Play Store web portal",
        isPublicRequest: true,
      };

      if (isEmail) {
        payload.email = identifier.trim();
      } else {
        payload.phone = identifier.trim();
      }

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request.");
      }

      setRequestId(data.requestId || "DEL-REQUEST");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again or contact support.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      {/* Header Bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-foreground hover:opacity-80 transition-opacity">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to {SITE_NAME}</span>
          </Link>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
            Account & Data Safety
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-xs font-semibold">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Google Play Data Safety & DPDP Compliance</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Request Account & Data Deletion</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              In accordance with Google Play Store User Data Policies and applicable privacy laws, {SITE_NAME} provides complete transparency on how your account and associated personal data are permanently deleted.
            </p>
          </div>

          {/* Policy Disclosures Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              Data Retention & Purge Policy
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs leading-relaxed">
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <span className="font-bold text-red-600 dark:text-red-400 block text-sm">What is Permanently Deleted:</span>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Full profile information (Name, Email, Phone number, Profile photo)</li>
                  <li>Uploaded KYC documents, Aadhaar/PAN references, and identity verification photos</li>
                  <li>Candidate resumes and job application records</li>
                  <li>Saved addresses and live GPS location coordinates</li>
                  <li>Device push notification tokens and active sessions</li>
                  <li>Direct in-app messages and communication logs</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <span className="font-bold text-amber-600 dark:text-amber-400 block text-sm">What is Retained by Law:</span>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Financial & transaction invoice numbers required under Indian GST / taxation laws for statutory audit periods (7 years)</li>
                  <li>Anonymized service completion timestamps with all personal customer identifiers redacted</li>
                  <li>Security audit logs related to resolved dispute cases</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Processing Timeframe: Requests submitted via this portal are verified and permanently purged within <strong>48 hours</strong>. Logged-in users can execute instant deletion from their account settings.</span>
            </div>
          </div>

          {/* Instant Login Prompt */}
          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Want to delete your account instantly?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Log in to your account and trigger one-click deletion from your profile settings.</p>
            </div>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow transition-colors shrink-0"
            >
              Log In to Delete Instantly
            </Link>
          </div>

          {/* Form / Success State */}
          {submitted ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Deletion Request Registered</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Your request has been successfully recorded under reference ID <strong className="text-foreground">{requestId}</strong>. All associated personal data and files will be permanently purged within 48 hours.
              </p>
              <div className="pt-4">
                <Link
                  href="/"
                  className="inline-flex px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
              <h2 className="text-lg font-bold text-foreground">Submit Web Deletion Request</h2>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Type *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "customer" as const, label: "Customer / Citizen" },
                    { id: "service_provider" as const, label: "Service Provider" },
                    { id: "job_provider" as const, label: "Job Provider / Employer" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRole(item.id)}
                      className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                        role === item.id
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Identifier Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Registered Email Address or Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. name@example.com or 9876543210"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-muted/40 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Reason (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Reason for Deletion (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Please let us know why you are leaving so we can improve."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={confirmUnderstood}
                  onChange={(e) => setConfirmUnderstood(e.target.checked)}
                  className="mt-0.5 rounded border-red-500 text-red-600 focus:ring-red-500"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  I understand that this action is irreversible. All my personal profile data, KYC records, and active job/application information will be permanently removed.
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Registering Deletion Request...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Submit Account Deletion Request</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Grievance Officer Support Contact */}
          <div className="text-center text-xs text-muted-foreground pt-4">
            <span>Need assistance with your data rights? Contact our Grievance Officer at </span>
            <a href="mailto:grievance@belconnect.in" className="text-primary underline">
              grievance@belconnect.in
            </a>
            <span>. Response guaranteed within 48 hours.</span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

