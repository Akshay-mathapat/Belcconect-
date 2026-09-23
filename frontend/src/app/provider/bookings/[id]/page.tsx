"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Phone, MapPin, Calendar, Clock, CheckCircle, Navigation,
  ShieldCheck, AlertCircle, Radio, UserCheck, MessageSquare,
  Star, ShieldAlert, X, CheckCircle2
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useProviderStore } from "@/store/useProviderStore";
import ProviderMapView from "@/components/location/ProviderMapView";
import BookingStatusStepper from "@/components/location/BookingStatusStepper";
import ProviderForegroundNoticeModal from "@/components/location/ProviderForegroundNoticeModal";
import ProviderTrackingStatusBar from "@/components/location/ProviderTrackingStatusBar";
import CallButton from "@/components/calls/CallButton";
import ChatButton from "@/components/chat/ChatButton";
import { useLiveLocationBroadcast } from "@/hooks/useLiveLocationBroadcast";
import { useTranslation } from "@/lib/i18n";
import { Booking, BookingStatus } from "@/types/provider";
import { getSocket } from "@/lib/socket";

export default function ProviderBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { currentUser } = useAuthStore();
  const { bookings, updateBookingStatus, fetchProviderBookings } = useProviderStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [localBooking, setLocalBooking] = useState<Booking | null>(null);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("Provider unavailable");
  const [cancellationNote, setCancellationNote] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Safety Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("Safety concern");
  const [reportDescription, setReportDescription] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Provider -> Customer Review State
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [providerReviewedSuccess, setProviderReviewedSuccess] = useState(false);

  useEffect(() => {
    fetchProviderBookings();
    const intervalId = setInterval(() => {
      fetchProviderBookings();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [fetchProviderBookings]);

  // Handlers
  const handleCancelBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setIsCancelling(true);
    try {
      const token = currentUser?.token || (typeof window !== "undefined" ? localStorage.getItem("cityconnect_auth_token") || localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") : null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: "Cancelled",
          cancellationReason,
          cancellationNote
        })
      });
      if (res.ok) {
        const data = await res.json();
        setLocalBooking(data.booking);
        fetchProviderBookings();
        setShowCancelModal(false);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to cancel booking");
      }
    } catch (err) {
      alert("Network error cancelling booking");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setIsReporting(true);
    try {
      const token = currentUser?.token || (typeof window !== "undefined" ? localStorage.getItem("cityconnect_auth_token") || localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") : null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/bookings/${booking.id}/report`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          reason: reportReason,
          description: reportDescription
        })
      });
      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setShowReportModal(false);
          setReportSuccess(false);
          setReportDescription("");
        }, 2000);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit report");
      }
    } catch (err) {
      alert("Network error submitting report");
    } finally {
      setIsReporting(false);
    }
  };

  const handleReviewCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setIsSubmittingReview(true);
    try {
      const token = currentUser?.token || (typeof window !== "undefined" ? localStorage.getItem("cityconnect_auth_token") || localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") : null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/bookings/${booking.id}/reviews`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          rating: ratingValue,
          comment: reviewText.trim()
        })
      });
      if (res.ok) {
        setProviderReviewedSuccess(true);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit review");
      }
    } catch (err) {
      alert("Network error submitting review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Fallback direct fetch in case store hasn't populated yet
  useEffect(() => {
    let isMounted = true;
    async function loadDirectBooking() {
      try {
        const token = currentUser?.token || (typeof window !== "undefined" ? localStorage.getItem("cityconnect_auth_token") || localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") : null);
        const headers: Record<string, string> = {};
        if (currentUser?.id) headers["x-user-id"] = currentUser.id;
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/bookings/${id}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.booking) {
            setLocalBooking(data.booking);
          }
        }
      } catch (e) {
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }
    loadDirectBooking();
    return () => { isMounted = false; };
  }, [id, currentUser]);

  // Socket.IO Status Synchronizer
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit("booking:subscribe", { bookingId: id });

    const handleStatusUpdated = (data: any) => {
      if (data && data.bookingId === id && data.status) {
        fetchProviderBookings();
        setLocalBooking((prev) => prev ? { ...prev, status: data.status as BookingStatus } : prev);
      }
    };

    socket.on("booking:status_updated", handleStatusUpdated);

    return () => {
      socket.emit("booking:unsubscribe", { bookingId: id });
      socket.off("booking:status_updated", handleStatusUpdated);
    };
  }, [id, fetchProviderBookings]);

  const [statusError, setStatusError] = useState<string | null>(null);

  const booking = bookings.find((b) => b.id === id) || localBooking;

  // Broadcast Provider GPS location
  const {
    isTracking,
    lastPosition,
    accuracy,
    isBackground,
    isOffline,
    lastTxTimestamp,
    showNoticeModal,
    dismissNoticeModal,
    triggerNoticeModal,
    wakeLockSupported,
    wakeLockActive,
    toggleWakeLock
  } = useLiveLocationBroadcast(booking?.id, booking?.status);

  if (initialLoading && !booking) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold text-foreground">Loading Booking #{id}...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm font-bold text-foreground">Booking #{id} not found.</p>
        <Link href="/provider/bookings" className="text-xs font-bold text-blue-600 hover:underline">
          Back to Bookings
        </Link>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: BookingStatus) => {
    setLoading(true);
    setStatusError(null);
    try {
      await updateBookingStatus(booking.id, newStatus);
      // Emit real-time status update to socket room so customer view updates instantly!
      const socket = getSocket();
      if (socket) {
        socket.emit("booking:status_update", {
          bookingId: booking.id,
          status: newStatus
        });
      }
    } catch (err: any) {
      console.error("Error updating status:", err);
      setStatusError(err.message || "Failed to update status on server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href="/provider/bookings"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("serviceProvider.backToAllBookings")}</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-600/10 text-blue-600 border border-blue-600/20">
            {t("serviceProvider.bookingId")}: {booking.id}
          </span>

          {["Requested", "Accepted"].includes(booking.status) && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="px-3 py-1 rounded-xl text-xs font-bold text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 border border-border hover:border-rose-500/30 transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
            title="Report safety or customer issue"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Report</span>
          </button>
        </div>
      </div>

      {/* Status Update Error Alert */}
      {statusError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-between">
          <span>{statusError}</span>
          <button onClick={() => setStatusError(null)} className="font-bold underline hover:no-underline">Dismiss</button>
        </div>
      )}

      {/* Unified Status Stepper (Domino's Progress Tracker) */}
      <BookingStatusStepper status={booking.status as BookingStatus} />

      {/* Persistent Status Bar for Active Location Sharing */}
      <ProviderTrackingStatusBar
        isTracking={isTracking}
        isBackground={isBackground}
        isOffline={isOffline}
        accuracy={accuracy}
        lastTxTimestamp={lastTxTimestamp}
        wakeLockSupported={wakeLockSupported}
        wakeLockActive={wakeLockActive}
        onToggleWakeLock={toggleWakeLock}
        onShowNoticeModal={triggerNoticeModal}
      />

      {/* Mobile-Friendly Foreground Guidance Notice Modal */}
      <ProviderForegroundNoticeModal
        isOpen={showNoticeModal}
        onGotIt={dismissNoticeModal}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Columns: Customer Details & Map View */}
        <div className="lg:col-span-2 space-y-6">

          {/* Customer Header Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6 pb-6 border-b border-border">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center border border-border shrink-0 shadow-md">
                  {booking.customerName ? booking.customerName.trim().charAt(0).toUpperCase() : "C"}
                </div>
                <div>
                  <h1 className="font-heading text-xl font-bold text-foreground">{booking.customerName}</h1>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> {t("serviceProvider.privateCallingEnabled")}
                  </p>
                </div>
              </div>

              {/* Encrypted Call & Chat Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <CallButton
                  bookingId={booking.id}
                  bookingStatus={booking.status}
                  size="md"
                />
                <ChatButton
                  customerId={booking.customerId || (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "customer-1" : "")}
                  providerId={currentUser?.id || (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "provider-1" : "")}
                  bookingId={booking.id}
                  peerName={booking.customerName || "Customer"}
                  serviceName={booking.serviceName}
                  bookingStatus={booking.status}
                />
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-bold">Action Needed:</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                  {t(`account.statuses.${booking.status}`) || booking.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {booking.status === "Requested" && (
                  <button
                    disabled={loading}
                    onClick={() => handleStatusChange("Accepted")}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    Accept Booking
                  </button>
                )}
                {booking.status === "Accepted" && (
                  <button
                    disabled={loading}
                    onClick={() => handleStatusChange("OnTheWay")}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-300" />
                    <span>Start Travel (On The Way)</span>
                  </button>
                )}
                {booking.status === "OnTheWay" && (
                  <button
                    disabled={loading}
                    onClick={() => handleStatusChange("Started")}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    Start Work
                  </button>
                )}
                {booking.status === "Started" && (
                  <button
                    disabled={loading}
                    onClick={() => handleStatusChange("Completed")}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    Mark Job Completed
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Synchronized Map View */}
          <ProviderMapView
            bookingId={booking.id}
            latitude={booking.destinationLatitude ?? null}
            longitude={booking.destinationLongitude ?? null}
            providerLatitude={lastPosition?.latitude ?? booking.providerCurrentLatitude}
            providerLongitude={lastPosition?.longitude ?? booking.providerCurrentLongitude}
            address={booking.destinationAddress || booking.address}
            landmark={booking.destinationLandmark}
            instructions={booking.destinationInstructions}
            customerName={booking.customerName}
            customerPhone={booking.customerPhone}
          />

          {/* Cancellation Information Banner */}
          {booking.status === "Cancelled" && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 shadow-sm space-y-2 text-center">
              <span className="px-3 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-xs font-bold uppercase tracking-wider">
                Booking Cancelled
              </span>
              <h3 className="text-base font-bold text-foreground">
                This service request was cancelled
              </h3>
              {booking.cancellationReason && (
                <p className="text-xs text-muted-foreground">
                  Reason: <strong className="text-foreground">{booking.cancellationReason}</strong>
                </p>
              )}
              {booking.cancellationNote && (
                <p className="text-xs text-muted-foreground italic bg-background/50 p-2.5 rounded-xl border border-border/50 max-w-md mx-auto">
                  &ldquo;{booking.cancellationNote}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Provider -> Customer Review Box (Completed Bookings) */}
          {(booking.status === "Completed" || booking.status === "ReviewSubmitted") && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-heading text-sm font-bold text-foreground">
                  Rate Customer ({booking.customerName})
                </h3>
                {providerReviewedSuccess && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Feedback Saved
                  </span>
                )}
              </div>

              {providerReviewedSuccess ? (
                <div className="p-3 bg-muted/20 rounded-xl text-xs text-muted-foreground">
                  Thank you! Your feedback on this customer has been recorded privately for the platform.
                </div>
              ) : (
                <form onSubmit={handleReviewCustomerSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                      Rate your experience with this customer:
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingValue(star)}
                          className="p-1 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= ratingValue
                                ? "text-amber-500 fill-amber-500"
                                : "text-muted-foreground/30 hover:text-amber-400"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-foreground ml-2">
                        {ratingValue} / 5
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                      Private notes on customer (optional):
                    </label>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Was the customer communicative, respectful, and on schedule?"
                      rows={2}
                      className="w-full p-3 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingReview ? "Saving..." : "Submit Customer Rating"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Job & Payment Summary */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="font-heading text-sm font-bold text-foreground">
              {t("serviceProvider.jobSummary")}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-muted-foreground">{t("serviceProvider.service")}:</span>
                <span className="font-bold text-foreground">{booking.serviceName}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-muted-foreground">{t("serviceProvider.category")}:</span>
                <span className="font-bold text-foreground">{booking.category}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-muted-foreground">Scheduled Date:</span>
                <span className="font-bold text-blue-600">{booking.date}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-muted-foreground">Time Slot:</span>
                <span className="font-bold text-blue-600">{booking.time}</span>
              </div>

            </div>
          </div>

          {/* Delivery Spot Address Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Customer Destination
              </h4>
            </div>
            <p className="text-xs font-bold text-foreground leading-snug">{booking.address}</p>
          </div>
        </div>

      </div>

      {/* Structured Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-heading text-lg font-bold text-foreground">
                Cancel Booking
              </h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCancelBookingSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  Why are you cancelling?
                </label>
                {[
                  "Provider unavailable",
                  "Schedule changed",
                  "Customer unavailable",
                  "Unable to contact",
                  "Booked by mistake",
                  "Other"
                ].map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                      cancellationReason === reason
                        ? "border-blue-600 bg-blue-500/10 font-bold text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="providerCancellationReason"
                      value={reason}
                      checked={cancellationReason === reason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      className="text-blue-600 focus:ring-blue-600"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Tell us more (optional):
                </label>
                <textarea
                  value={cancellationNote}
                  onChange={(e) => setCancellationNote(e.target.value)}
                  placeholder="Provide additional details..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-bold transition-all cursor-pointer"
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safety & Customer Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Report Customer Concern
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-foreground">Report Received</h4>
                <p className="text-xs text-muted-foreground">
                  Thank you for reporting. BelConnect operations will review this incident.
                </p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Reports are private and protect service providers and customer community standards.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">
                    Reason:
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    {[
                      "Safety concern",
                      "Harassment",
                      "Fraud/scam concern",
                      "Incorrect service information",
                      "No-show",
                      "Inappropriate behavior",
                      "Other"
                    ].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Description:
                  </label>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Describe the issue..."
                    rows={3}
                    className="w-full p-3 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isReporting}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isReporting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
