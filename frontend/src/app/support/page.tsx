"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
  Ticket
} from "lucide-react";
import Footer from "@/components/sections/Footer";
import { useAuthStore } from "@/store/useAuthStore";

interface SimpleBooking {
  id: string;
  serviceName: string;
  status: string;
  date?: string;
}

function SupportFormContent() {
  const searchParams = useSearchParams();
  const queryBookingId = searchParams.get("bookingId") || "";

  const { currentUser } = useAuthStore();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [bookingId, setBookingId] = useState(queryBookingId);
  const [isManualBooking, setIsManualBooking] = useState(Boolean(queryBookingId));

  const [userBookings, setUserBookings] = useState<SimpleBooking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{ ticketId?: string; message?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getStoredToken = () => {
    if (currentUser?.token) return currentUser.token;
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("cityconnect_auth_token") ||
        localStorage.getItem("cityconnect_token") ||
        localStorage.getItem("auth_token") ||
        null
      );
    }
    return null;
  };

  const token = getStoredToken();
  const isAuthenticated = Boolean(currentUser || token);

  // Fetch authenticated user's bookings to populate optional selector
  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    async function loadBookings() {
      setIsLoadingBookings(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/bookings", { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            const mapped = data.map((b: any) => ({
              id: b.id,
              serviceName: b.serviceName || b.service || "Service",
              status: b.status || "Unknown",
              date: b.date || "",
            }));
            setUserBookings(mapped);

            // If queryBookingId matches one of the bookings, keep it selected
            if (queryBookingId && mapped.some((b) => b.id.toLowerCase() === queryBookingId.toLowerCase())) {
              setIsManualBooking(false);
              setBookingId(queryBookingId);
            }
          }
        }
      } catch (err) {
        console.error("Could not load bookings for selector:", err);
      } finally {
        if (isMounted) setIsLoadingBookings(false);
      }
    }

    loadBookings();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, token, queryBookingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isAuthenticated) {
      setErrorMessage("You must be signed in to submit a support request.");
      return;
    }

    if (!subject || subject.trim().length === 0) {
      setErrorMessage("Please enter a subject for your support request.");
      return;
    }

    if (subject.trim().length > 255) {
      setErrorMessage("Subject cannot exceed 255 characters.");
      return;
    }

    if (!message || message.trim().length === 0) {
      setErrorMessage("Please enter a message describing your inquiry.");
      return;
    }

    if (message.trim().length > 3000) {
      setErrorMessage("Message cannot exceed 3000 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/support", {
        method: "POST",
        headers,
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          bookingId: bookingId && bookingId.trim().length > 0 ? bookingId.trim() : null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessData({
          ticketId: data.ticketId,
          message: data.message || "Your support request has been submitted. Our support team will review your inquiry.",
        });
        setSubject("");
        setMessage("");
        setBookingId("");
      } else if (res.status === 403) {
        setErrorMessage("Forbidden: You cannot attach a booking that does not belong to your account.");
      } else if (res.status === 404) {
        setErrorMessage("Specified booking was not found. Please check the booking ID or leave it unselected.");
      } else if (res.status === 401) {
        setErrorMessage("Your session has expired. Please sign in again.");
      } else {
        setErrorMessage(data.error || "Failed to submit support request. Please try again.");
      }
    } catch (err: any) {
      setErrorMessage("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessData(null);
    setErrorMessage(null);
    setSubject("");
    setMessage("");
    setBookingId("");
    setIsManualBooking(false);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link
          href="/help"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors min-h-[44px] py-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Help & Support</span>
        </Link>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-3">
          <HelpCircle className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-heading font-bold tracking-tight mb-2">Contact Support</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Submit an inquiry or report an issue regarding your account or bookings.
        </p>
      </div>

      {/* Authentication Guard */}
      {!isAuthenticated ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <LogIn className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Sign In Required</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You must be signed in with your BelConnect account to submit a support request.
          </p>
          <div className="pt-2">
            <Link
              href="/login?redirect=/support"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all min-h-[44px] shadow-sm"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In to Continue</span>
            </Link>
          </div>
        </div>
      ) : successData ? (
        /* Success State */
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Request Submitted</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {successData.message}
          </p>

          {successData.ticketId && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-muted border border-border text-xs font-mono text-foreground font-semibold">
              <Ticket className="h-3.5 w-3.5 text-blue-600" />
              <span>Ticket ID: {successData.ticketId}</span>
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors min-h-[44px] cursor-pointer"
            >
              Submit Another Request
            </button>
            <Link
              href="/help"
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              Return to Help & Support
            </Link>
          </div>
        </div>
      ) : (
        /* Support Request Form */
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* 1. Subject */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="support-subject" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Subject <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {subject.length} / 255
                </span>
              </div>
              <input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, 255))}
                placeholder="Brief summary of your inquiry (e.g., Booking query, app feedback)"
                required
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              />
            </div>

            {/* 2. Related Booking (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="support-booking" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Related Booking <span className="font-normal lowercase text-[11px]">(optional)</span>
                </label>
                {userBookings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualBooking(!isManualBooking);
                      if (isManualBooking) setBookingId("");
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    {isManualBooking ? "Choose from my bookings" : "Enter ID manually"}
                  </button>
                )}
              </div>

              {isManualBooking || userBookings.length === 0 ? (
                <div>
                  <input
                    id="support-booking"
                    type="text"
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value.trim())}
                    placeholder="Enter Booking ID (e.g. B-1234, optional)"
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Must belong to your account if specified. Leave blank for general support.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <select
                    id="support-booking"
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
                  >
                    <option value="">None (General Inquiry)</option>
                    {userBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        #{b.id} â€” {b.serviceName} ({b.status}{b.date ? ` â€¢ ${b.date}` : ""})
                      </option>
                    ))}
                  </select>
                  {isLoadingBookings && (
                    <p className="text-[11px] text-muted-foreground">Loading recent bookings...</p>
                  )}
                </div>
              )}
            </div>

            {/* 3. Message */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="support-message" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Message Details <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {message.length} / 3000
                </span>
              </div>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 3000))}
                placeholder="Please describe your inquiry, issue, or question in detail..."
                rows={6}
                required
                className="w-full p-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all resize-y"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !subject.trim() || !message.trim()}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <span>Submit Support Request</span>
                )}
              </button>
            </div>

          </form>
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <div className="flex-1 pt-6 pb-20 px-4 sm:px-6 lg:px-8">
        <Suspense fallback={
          <div className="mx-auto max-w-2xl py-12 text-center text-muted-foreground animate-pulse">
            Loading support center...
          </div>
        }>
          <SupportFormContent />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
