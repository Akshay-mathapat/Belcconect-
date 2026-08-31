"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { 
  ArrowLeft, Calendar, Clock, MapPin, Phone, MessageSquare, 
  CheckCircle2, ShieldCheck, UserCheck, Radio, AlertCircle, ExternalLink, Navigation
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
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (!currentUser) {
      router.push(`/auth?mode=login&returnTo=/bookings/${id}`);
    }
  }, [currentUser, router, id]);

  // Activate Customer Live GPS Broadcast when booking tracking window is active and customer grants permission
  const { isTracking: isCustomerBroadcasting, error: gpsError } = useLiveLocationBroadcast(
    booking?.id,
    booking?.status,
    "customer",
    shareLiveLocation
  );

  // 1. Initial Fetch Booking Detail
  useEffect(() => {
    async function fetchBookingDetail() {
      try {
        const res = await fetch(`/api/bookings/${id}`);
        if (!res.ok) throw new Error("Booking not found");
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
  }, [id]);

  // 2. Real-Time Socket Listener for Instant Status Updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit("booking:subscribe", { bookingId: id });

    const handleStatusUpdated = (data: any) => {
      if (data && data.bookingId === id && data.status) {
        setBooking((prev) => (prev ? { ...prev, status: data.status as BookingStatus } : prev));
      }
    };

    socket.on("booking:status_updated", handleStatusUpdated);

    return () => {
      socket.emit("booking:unsubscribe", { bookingId: id });
      socket.off("booking:status_updated", handleStatusUpdated);
    };
  }, [id]);

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
          href="/bookings"
          className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Bookings
        </Link>
      </div>
    );
  }

  const isActiveTracking = ["Accepted", "OnTheWay", "Started"].includes(booking.status);

  return (
    <div className="min-h-screen bg-background pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Bookings</span>
          </Link>

          <span className="text-xs font-mono font-bold text-muted-foreground uppercase">
            Order #{booking.id}
          </span>
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
                      customerId={booking.customerId || "customer-1"}
                      providerId={booking.providerId || "provider-1"}
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

        {/* ═══════ STATE 3: COMPLETED / REJECTED ═══════ */}
        {!isActiveTracking && booking.status !== "Requested" && (
          <div className="rounded-3xl border border-border bg-card p-8 sm:p-12 text-center space-y-6 shadow-xl max-w-xl mx-auto">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                {booking.status}
              </span>
              <h2 className="text-2xl font-heading font-bold text-foreground">
                Service Order Completed
              </h2>
              <p className="text-xs text-muted-foreground">
                Thank you for using BelConnect! Your service for <strong>{booking.serviceName}</strong> has been fulfilled by {booking.providerName}.
              </p>
            </div>

            <Link
              href="/bookings"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md hover:bg-blue-700 transition-all"
            >
              <span>View All Bookings</span>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
