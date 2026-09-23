"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn
} from "lucide-react";
import Footer from "@/components/sections/Footer";
import { useAuthStore } from "@/store/useAuthStore";

const FEEDBACK_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "booking_flow", label: "Booking Experience" },
  { value: "calling_chat", label: "Calling & Chat" },
  { value: "location_tracking", label: "Location & Tracking" },
  { value: "provider_quality", label: "Provider Quality" },
  { value: "feature_request", label: "Feature Request" },
] as const;

export default function FeedbackPage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [category, setCategory] = useState<string>("general");
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isAuthenticated) {
      setErrorMessage("You must be signed in to submit feedback.");
      return;
    }

    if (!message || message.trim().length === 0) {
      setErrorMessage("Please enter a feedback message.");
      return;
    }

    if (message.trim().length > 3000) {
      setErrorMessage("Feedback message cannot exceed 3000 characters.");
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

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify({
          category,
          rating: rating ?? null,
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(data.message || "Thank you for your feedback! It helps us improve BelConnect.");
        setMessage("");
        setRating(null);
      } else if (res.status === 401) {
        setErrorMessage("Your session has expired. Please sign in again.");
      } else {
        setErrorMessage(data.error || "Failed to submit feedback. Please try again.");
      }
    } catch (err: any) {
      setErrorMessage("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setCategory("general");
    setRating(null);
    setMessage("");
  };

  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <div className="flex-1 pt-6 pb-20 px-4 sm:px-6 lg:px-8">
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
              <MessageSquare className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-heading font-bold tracking-tight mb-2">Send Feedback</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Help us improve BelConnect. Share your thoughts, report issues, or suggest new features.
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
                You must be signed in with your BelConnect customer or service provider account to submit feedback.
              </p>
              <div className="pt-2">
                <Link
                  href="/login?redirect=/feedback"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all min-h-[44px] shadow-sm"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In to Continue</span>
                </Link>
              </div>
            </div>
          ) : successMessage ? (
            /* Success State */
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Feedback Received</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {successMessage}
              </p>
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors min-h-[44px] cursor-pointer"
                >
                  Submit Another Feedback
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
            /* Feedback Form */
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">

                {/* 1. Category */}
                <div>
                  <label htmlFor="feedback-category" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="feedback-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
                  >
                    {FEEDBACK_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Rating (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Experience Rating <span className="font-normal lowercase text-[11px]">(optional)</span>
                    </label>
                    {rating !== null && (
                      <button
                        type="button"
                        onClick={() => setRating(null)}
                        className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Clear rating
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = (hoverRating !== null ? hoverRating : rating !== null ? rating : 0) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(rating === star ? null : star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          className="p-2 hover:scale-110 transition-transform cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                        >
                          <Star
                            className={`h-6 w-6 transition-colors ${
                              isFilled
                                ? "text-amber-500 fill-amber-500"
                                : "text-muted-foreground/30 hover:text-amber-400"
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="text-xs font-medium text-muted-foreground ml-2">
                      {rating !== null ? `${rating} / 5 Stars` : "No rating selected"}
                    </span>
                  </div>
                </div>

                {/* 3. Message */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="feedback-message" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Your Message <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      {message.length} / 3000
                    </span>
                  </div>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 3000))}
                    placeholder="Tell us about your experience, what went well, or what could be improved..."
                    rows={5}
                    required
                    className="w-full p-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all resize-y"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !message.trim()}
                    className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Submitting Feedback...</span>
                      </>
                    ) : (
                      <span>Submit Feedback</span>
                    )}
                  </button>
                </div>

              </form>
            </div>
          )}

        </div>
      </div>
      <Footer />
    </main>
  );
}
