"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, getStoredAuthToken, getStoredUserId } from "@/store/useAuthStore";
import {
  ArrowLeft, Calendar, Clock, MapPin, Phone, MessageSquare,
  CheckCircle2, ShieldCheck, UserCheck, Radio, AlertCircle, ExternalLink, Navigation,
  Star, ShieldAlert, X
} from "lucide-react";
import { Booking, BookingStatus } from "@/types/provider";
import CustomerTrackingMap from "@/components/location/CustomerTrackingMap";
import BookingStatusStepper from "@/components/location/BookingStatusStepper";
import CallButton from "@/components/calls/CallButton";
import ChatButton from "@/components/chat/ChatButton";
import { useTranslation } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import { useLiveLocationBroadcast } from "@/hooks/useLiveLocationBroadcast";

export default function CustomerTrackingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const cleanBookingId = useMemo(() => {
    if (!id) return "";
    return decodeURIComponent(id).trim().replace(/^#/, "");
  }, [id]);

  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("Schedule changed");
  const [cancellationNote, setCancellationNote] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Safety Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("Safety concern");
  const [reportDescription, setReportDescription] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Review Form State
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmittedSuccess, setReviewSubmittedSuccess] = useState(false);
  const [customerReview, setCustomerReview] = useState<{ rating: number; comment: string } | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(true);
  const [reviewFetchError, setReviewFetchError] = useState<string | null>(null);

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));
    return () => unsub();
  }, []);

  const fetchReviewStatus = async (targetBookingId: string) => {
    setIsReviewLoading(true);
    setReviewFetchError(null);
    try {
      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/bookings/${encodeURIComponent(targetBookingId)}/reviews`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.userReview) {
          setCustomerReview({
            rating: Number(data.userReview.rating),
            comment: data.userReview.comment || ""
          });
        } else if (Array.isArray(data.reviews)) {
          const myRev = data.reviews.find(
            (r: any) => r.reviewerRole === "customer" || (currentUser?.id && r.reviewerId === currentUser.id)
          );
          if (myRev) {
            setCustomerReview({
              rating: Number(myRev.rating),
              comment: myRev.comment || ""
            });
          } else {
            setCustomerReview(null);
          }
        } else {
          setCustomerReview(null);
        }
      } else if (res.status === 401 || res.status === 403) {
        setReviewFetchError("Authentication required to view review status.");
      } else {
        setReviewFetchError("Unable to verify review status.");
      }
    } catch (e: any) {
      setReviewFetchError("Network error checking review status.");
    } finally {
      setIsReviewLoading(false);
    }
  };

  // Check review status when completed
  useEffect(() => {
    if (!booking) return;
    if (booking.status === "Completed" || booking.status === "ReviewSubmitted") {
      fetchReviewStatus(booking.id);
    } else {
      setIsReviewLoading(false);
    }
  }, [booking?.id, booking?.status]);

  // Handlers for Cancellation, Reporting, and Reviews
  const handleCancelBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setIsCancelling(true);
    try {
      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, {
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
        setBooking(data.booking);
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
      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/report`, {
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

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setIsSubmittingReview(true);
    try {
      const token = currentUser?.token || getStoredAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/reviews`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          rating: ratingValue,
          comment: reviewText.trim()
        })
      });
      if (res.ok) {
        setReviewSubmittedSuccess(true);
        setCustomerReview({ rating: ratingValue, comment: reviewText.trim() });
        setBooking((prev) => prev ? { ...prev, rating: ratingValue, reviewComment: reviewText.trim() } : prev);
      } else if (res.status === 409) {
        setReviewSubmittedSuccess(true);
        await fetchReviewStatus(booking.id);
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

  // Auth Guard
  useEffect(() => {
    if (!isHydrated) return;
    if (!currentUser) {
      router.push(`/auth?mode=login&returnTo=/bookings/${encodeURIComponent(cleanBookingId || id)}`);
    }
  }, [currentUser, router, id, cleanBookingId, isHydrated]);

  // Activate Customer Live GPS Broadcast when booking tracking window is active and customer grants permission
  const { isTracking: isCustomerBroadcasting, error: gpsError } = useLiveLocationBroadcast(
    booking?.id || cleanBookingId || id,
    booking?.status,
    "customer",
    shareLiveLocation
  );

  // 1. Initial Fetch Booking Detail
  useEffect(() => {
    async function fetchBookingDetail() {
      try {
        const targetId = cleanBookingId || id;
        if (!targetId) return;

        const token = currentUser?.token || getStoredAuthToken();
        const userId = currentUser?.id || getStoredUserId();
        const headers: Record<string, string> = {};
        if (userId) headers["x-user-id"] = userId;
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/bookings/${encodeURIComponent(targetId)}`, { headers });
        if (!res.ok) {
          if (res.status === 401) {
            router.push(`/auth?mode=login&returnTo=/bookings/${encodeURIComponent(targetId)}`);
            return;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || "Booking not found");
        }
        const data = await res.json();
        if (data.booking) {
          setBooking(data.booking);
        }
      } catch (err: any) {
        console.error("Error fetching booking tracking detail:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchBookingDetail();

    // Regular fallback polling every 6s
    const interval = setInterval(fetchBookingDetail, 6000);
    return () => clearInterval(interval);
  }, [id, cleanBookingId, currentUser, router]);

  // 2. Real-Time Socket Listener for Instant Status Updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const targetId = cleanBookingId || id;
    if (!targetId) return;

    socket.emit("booking:subscribe", { bookingId: targetId });

    const handleStatusUpdated = (data: any) => {
      if (data && (data.bookingId === targetId || data.bookingId === id) && data.status) {
        setBooking((prev) => (prev ? { ...prev, status: data.status as BookingStatus } : prev));
      }
    };

    socket.on("booking:status_updated", handleStatusUpdated);

    return () => {
      socket.emit("booking:unsubscribe", { bookingId: targetId });
      socket.off("booking:status_updated", handleStatusUpdated);
    };
  }, [id, cleanBookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4 pt-24">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-foreground">Loading Order Tracking...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-16 px-4 max-w-xl mx-auto text-center space-y-4">
        <div className="p-6 rounded-3xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 space-y-2">
          <AlertCircle className="w-10 h-10 mx-auto" />
          <h3 className="text-lg font-bold">Booking Not Found</h3>
          <p className="text-xs">{error || "Unable to retrieve tracking data for this booking ID."}</p>
        </div>
        <Link
          href="/account"
          className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Account
        </Link>
      </div>
    );
  }

  const isActiveTracking = ["Accepted", "OnTheWay", "Started"].includes(booking.status);

  return (
    <div className="min-h-screen bg-background pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header Link & Actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Account</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold text-muted-foreground uppercase">
              Order #{booking.id}
            </span>

            {["Requested", "Accepted"].includes(booking.status) && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="px-3 py-1 rounded-xl text-xs font-bold text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 border border-border hover:border-rose-500/30 transition-all cursor-pointer"
              >
                Cancel Order
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
              title="Report safety concern or problem"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Report</span>
            </button>
          </div>
        </div>

        {/* Unified Status Stepper (Domino's Style Progress Bar) */}
        <BookingStatusStepper status={booking.status as BookingStatus} />

        {/* ═══════ STATE 1: REQUESTED (Waiting for Acceptance) ═══════ */}
        {booking.status === "Requested" && (
          <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card to-card p-8 sm:p-12 text-center space-y-6 shadow-xl">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping" />
              <div className="relative w-16 h-16 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Clock className="w-8 h-8 animate-spin" />
              </div>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider border border-amber-500/20">
                Waiting for Acceptance
              </span>
              <h2 className="text-2xl font-heading font-extrabold text-foreground">
                Connecting with {booking.providerName}...
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Your request for <strong>{booking.serviceName}</strong> on <strong>{booking.date} at {booking.time}</strong> has been sent to the service professional.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-foreground">
                <span>Service Address:</span>
                <span className="text-muted-foreground">{booking.address}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-foreground">
                <span>Scheduled Arrival:</span>
                <span className="text-blue-600">{booking.time}</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ STATE 2: ACTIVE TRACKING (Accepted, On The Way, Started) ═══════ */}
        {isActiveTracking && (
          <div className="space-y-6">
            {/* Live Location Sharing Opt-in Banner */}
            <div className="rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-card to-card p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Radio className={`w-5 h-5 ${shareLiveLocation ? "text-emerald-500 animate-pulse" : "text-blue-600"}`} />
                  <h4 className="font-bold text-sm text-foreground">Share Your Live GPS Location</h4>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Allow your service expert to view your live position for faster navigation and seamless on-the-go service.
                </p>
                {gpsError && (
                  <p className="text-xs text-red-500 font-medium">{gpsError}</p>
                )}
              </div>
              <button
                onClick={() => setShareLiveLocation(!shareLiveLocation)}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-2xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                  shareLiveLocation && isCustomerBroadcasting
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    : shareLiveLocation && gpsError
                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                }`}
              >
                {shareLiveLocation && isCustomerBroadcasting ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>Live Location Sharing Active</span>
                  </>
                ) : shareLiveLocation && gpsError ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-white" />
                    <span>Permission Required</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Share Live Location</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 items-start">
              {/* Left 2 Columns: Live Map */}
              <div className="lg:col-span-2 space-y-6" data-tour="booking-tracking">
                <CustomerTrackingMap
                  bookingId={booking.id}
                  destinationLatitude={booking.destinationLatitude ?? (null as any)}
                  destinationLongitude={booking.destinationLongitude ?? (null as any)}
                  initialProviderLatitude={booking.providerCurrentLatitude}
                  initialProviderLongitude={booking.providerCurrentLongitude}
                  providerLocationUpdatedAt={booking.providerLocationUpdatedAt}
                  address={booking.destinationAddress || booking.address}
                  providerName={booking.providerName}
                />
              </div>

              {/* Right Column: Assigned Provider Card & Encrypted Calling */}
              <div className="space-y-6">
                {/* Assigned Provider Profile Card */}
                <div className="rounded-3xl border border-border bg-card p-6 shadow-md space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center border-2 border-blue-600/30 shadow-md shrink-0">
                      {booking.providerName ? booking.providerName.trim().charAt(0).toUpperCase() : "P"}
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        <UserCheck className="w-3 h-3" /> Assigned Pro
                      </span>
                      <h3 className="text-lg font-heading font-extrabold text-foreground leading-tight mt-0.5">
                        {booking.providerName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Verified {booking.category} Expert
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Service:</span>
                      <span className="font-bold text-foreground">{booking.serviceName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Scheduled Slot:</span>
                      <span className="font-bold text-blue-600">{booking.time}</span>
                    </div>
                  </div>

                  {/* Call & Chat Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1" data-tour="chat-call">
                    <CallButton
                      bookingId={booking.id}
                      bookingStatus={booking.status}
                      size="md"
                      className="w-full"
                    />
                    <ChatButton
                      customerId={booking.customerId || (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "customer-1" : "")}
                      providerId={booking.providerId || (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "provider-1" : "")}
                      bookingId={booking.id}
                      peerName={booking.providerName || "Service Expert"}
                      serviceName={booking.serviceName}
                      bookingStatus={booking.status}
                    />
                  </div>
                </div>

                {/* Confirmed Delivery Address Card */}
                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Service Spot Address
                    </h4>
                  </div>
                  <p className="text-sm font-bold text-foreground leading-snug">{booking.address}</p>
                  {booking.destinationLandmark && (
                    <p className="text-xs text-amber-600 font-medium">Landmark: {booking.destinationLandmark}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Summary Card (Domino's "Your Delivery Spot" Card Layout) */}
            <div className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-card to-slate-900 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                    Live Arrival Status: {booking.status}
                  </span>
                </div>
                <h3 className="text-xl font-heading font-extrabold text-foreground">
                  Your Service Professional is {booking.status === "OnTheWay" ? "on the way!" : "assigned & ready"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-xl">
                  {booking.providerName} is using live GPS location streaming. Track their movement on the map above in real-time.
                </p>
              </div>

              {booking.providerCurrentLatitude && booking.providerCurrentLongitude && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${booking.providerCurrentLatitude},${booking.providerCurrentLongitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all shrink-0"
                >
                  <Navigation className="w-4 h-4 fill-current" />
                  <span>Navigate to Provider Position</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ═══════ STATE 3A: CANCELLED / REJECTED ═══════ */}
        {booking.status === "Cancelled" && (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 sm:p-10 text-center space-y-4 max-w-xl mx-auto shadow-md">
            <div className="w-14 h-14 bg-rose-500/10 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <span className="px-3 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-xs font-bold uppercase tracking-wider">
                Booking Cancelled
              </span>
              <h2 className="text-xl font-heading font-bold text-foreground">
                This service order was cancelled
              </h2>
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
            <Link
              href="/services"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md hover:bg-blue-700 transition-all cursor-pointer"
            >
              <span>Explore Other Services</span>
            </Link>
          </div>
        )}

        {/* ═══════ STATE 3B: COMPLETED / REVIEW SUBMITTED ═══════ */}
        {!isActiveTracking && (booking.status === "Completed" || booking.status === "ReviewSubmitted") && (
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 text-center space-y-6 shadow-xl max-w-xl mx-auto">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                Service Order Completed
              </span>
              <h2 className="text-2xl font-heading font-bold text-foreground">
                Work Fulfilled
              </h2>
              <p className="text-xs text-muted-foreground">
                Thank you for using BelConnect! Your service for <strong>{booking.serviceName}</strong> has been completed by {booking.providerName}.
              </p>
            </div>

            {/* Rate & Review Provider Box */}
            <div className="p-5 rounded-2xl border border-border bg-muted/20 text-left space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-foreground">
                  Rate Your Experience with {booking.providerName}
                </h3>
                {(customerReview || reviewSubmittedSuccess) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Review Submitted
                  </span>
                )}
              </div>

              {isReviewLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
                  Checking review status...
                </div>
              ) : reviewFetchError ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-between">
                  <span>{reviewFetchError}</span>
                  <button
                    type="button"
                    onClick={() => fetchReviewStatus(booking.id)}
                    className="font-bold underline hover:no-underline ml-2 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : (customerReview || reviewSubmittedSuccess) ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= (customerReview?.rating || ratingValue)
                            ? "text-amber-500 fill-amber-500"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                    <span className="text-xs font-bold text-foreground ml-2">
                      {customerReview?.rating || ratingValue} / 5 Stars
                    </span>
                  </div>
                  {(customerReview?.comment || reviewText) && (
                    <p className="text-xs text-muted-foreground italic bg-background p-3 rounded-xl border border-border">
                      &ldquo;{customerReview?.comment || reviewText}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                      Select Rating:
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
                            className={`w-7 h-7 ${
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
                      Share feedback (optional):
                    </label>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="How was the professional quality and service behavior?"
                      rows={3}
                      className="w-full p-3 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingReview ? "Submitting Review..." : "Submit Review"}
                  </button>
                </form>
              )}
            </div>

            <Link
              href="/account"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs border border-border transition-all"
            >
              <span>Return to My Account</span>
            </Link>
          </div>
        )}

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
                    "Schedule changed",
                    "Provider unavailable",
                    "Customer unavailable",
                    "Booked by mistake",
                    "Unable to contact",
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
                        name="cancellationReason"
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

        {/* Safety & Participant Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2 text-rose-600">
                  <ShieldAlert className="w-5 h-5" />
                  <h3 className="font-heading text-lg font-bold text-foreground">
                    Report Safety or Service Issue
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
                    Thank you for helping keep BelConnect safe. Our trust &amp; safety team will review this interaction.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Your report is private and helps us maintain safety and service quality across Belagavi.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      Reason for report:
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
                      placeholder="Describe what happened in detail..."
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
    </div>
  );
}
