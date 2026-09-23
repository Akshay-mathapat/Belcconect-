"use client";

import { useState } from "react";
import Footer from "@/components/sections/Footer";
import { MessageSquare, ThumbsUp, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { getStoredAuthToken } from "@/store/useAuthStore";

export default function ContactPage() {
  const [activeTab, setActiveTab] = useState<"support" | "feedback">("support");

  // Support state
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportBookingId, setSupportBookingId] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  // Feedback state
  const [feedbackCategory, setFeedbackCategory] = useState("general");
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportError(null);
    const token = getStoredAuthToken() || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    if (!token) {
      setSupportError("Please log in to submit a support request.");
      return;
    }

    if (!supportSubject.trim() || !supportMessage.trim()) {
      setSupportError("Please enter both a subject and details of your request.");
      return;
    }

    setSupportSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: supportSubject.trim(),
          message: supportMessage.trim(),
          bookingId: supportBookingId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit support request");
      }

      setSupportSuccess(true);
      setSupportSubject("");
      setSupportMessage("");
      setSupportBookingId("");
    } catch (err: any) {
      setSupportError(err.message || "An unexpected error occurred");
    } finally {
      setSupportSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    if (!feedbackMessage.trim()) {
      setFeedbackError("Please provide your feedback comments.");
      return;
    }

    const token = getStoredAuthToken() || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    if (!token) {
      setFeedbackError("Please log in to submit feedback.");
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify({
          category: feedbackCategory,
          message: feedbackMessage.trim(),
          rating: feedbackRating ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setFeedbackSuccess(true);
      setFeedbackMessage("");
      setFeedbackRating(null);
    } catch (err: any) {
      setFeedbackError(err.message || "An unexpected error occurred");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <div className="flex-1 pt-10 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">

          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
              Contact & Support
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Have an issue with a booking or suggestions to improve BelConnect? Let us know.
            </p>
          </div>

          <div className="flex border-b border-border mb-8">
            <button
              onClick={() => { setActiveTab("support"); setSupportSuccess(false); }}
              className={`flex-1 pb-3 text-center font-medium text-sm sm:text-base border-b-2 flex items-center justify-center gap-2 transition-colors ${
                activeTab === "support"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Support Ticket
            </button>
            <button
              onClick={() => { setActiveTab("feedback"); setFeedbackSuccess(false); }}
              className={`flex-1 pb-3 text-center font-medium text-sm sm:text-base border-b-2 flex items-center justify-center gap-2 transition-colors ${
                activeTab === "feedback"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ThumbsUp className="h-4 w-4" />
              App Feedback
            </button>
          </div>

          {activeTab === "support" && (
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-2">Create a Support Request</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Our support team will review your inquiry and follow up promptly.
              </p>

              {supportSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                  <h3 className="text-lg font-semibold text-foreground">Support Request Received</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Thank you. Your ticket has been logged and assigned to the BelConnect operations desk.
                  </p>
                  <button
                    onClick={() => setSupportSuccess(false)}
                    className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSupportSubmit} className="space-y-4">
                  {supportError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{supportError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1">Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Issue with booking schedule or provider communication"
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Booking Reference / ID <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. bk_123 or leave blank if general"
                      value={supportBookingId}
                      onChange={(e) => setSupportBookingId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Details</label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Describe what happened in detail..."
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={supportSubmitting}
                    className="w-full py-3 px-4 rounded-xl font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition"
                  >
                    {supportSubmitting ? (
                      "Submitting..."
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Support Request
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === "feedback" && (
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-2">App & Service Feedback</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Tell us how we can make BelConnect better for customers and providers in Belagavi.
              </p>

              {feedbackSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                  <h3 className="text-lg font-semibold text-foreground">Thank You for Your Feedback!</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    We appreciate your input. It helps us continually refine our services and local operations.
                  </p>
                  <button
                    onClick={() => setFeedbackSuccess(false)}
                    className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Submit More Feedback
                  </button>
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                  {feedbackError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{feedbackError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1">Feedback Category</label>
                    <select
                      value={feedbackCategory}
                      onChange={(e) => setFeedbackCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    >
                      <option value="general">General Experience</option>
                      <option value="booking_flow">Booking Flow</option>
                      <option value="calling_chat">Calls & Chat</option>
                      <option value="location_tracking">Live Location & Map</option>
                      <option value="provider_quality">Provider Experience</option>
                      <option value="feature_request">Feature Request</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Overall Platform Rating <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(feedbackRating === star ? null : star)}
                          className={`w-10 h-10 rounded-xl font-semibold text-sm transition-all border ${
                            feedbackRating && feedbackRating >= star
                              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                              : "bg-muted text-muted-foreground border-border hover:border-foreground/30"
                          }`}
                        >
                          {star}★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Your Feedback</label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Share your thoughts, suggestions, or issues..."
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={feedbackSubmitting}
                    className="w-full py-3 px-4 rounded-xl font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition"
                  >
                    {feedbackSubmitting ? (
                      "Submitting..."
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Feedback
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
      <Footer />
    </main>
  );
}
