"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Phone, MapPin, Calendar, Clock, CheckCircle, Navigation, 
  ShieldCheck, AlertCircle, Radio, UserCheck, MessageSquare
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useProviderStore } from "@/store/useProviderStore";
import ProviderMapView from "@/components/location/ProviderMapView";
import BookingStatusStepper from "@/components/location/BookingStatusStepper";
import CallButton from "@/components/calls/CallButton";
import ChatButton from "@/components/chat/ChatButton";
import { useLiveLocationBroadcast } from "@/hooks/useLiveLocationBroadcast";
import { useTranslation } from "@/lib/i18n";
import { BookingStatus } from "@/types/provider";
import { getSocket } from "@/lib/socket";

export default function ProviderBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { currentUser } = useAuthStore();
  const { bookings, updateBookingStatus, fetchProviderBookings } = useProviderStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProviderBookings();
    const intervalId = setInterval(() => {
      fetchProviderBookings();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [fetchProviderBookings]);

  // Socket.IO Status Synchronizer
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit("booking:subscribe", { bookingId: id });

    const handleStatusUpdated = (data: any) => {
      if (data && data.bookingId === id && data.status) {
        fetchProviderBookings();
      }
    };

    socket.on("booking:status_updated", handleStatusUpdated);

    return () => {
      socket.emit("booking:unsubscribe", { bookingId: id });
      socket.off("booking:status_updated", handleStatusUpdated);
    };
  }, [id, fetchProviderBookings]);

  const booking = bookings.find((b) => b.id === id) || bookings[0];

  // Broadcast Provider GPS location
  const { isTracking, lastPosition } = useLiveLocationBroadcast(booking?.id, booking?.status);

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
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/provider/bookings"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("serviceProvider.backToAllBookings")}</span>
        </Link>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-600/10 text-blue-600 border border-blue-600/20">
          {t("serviceProvider.bookingId")}: {booking.id}
        </span>
      </div>

      {/* Unified Status Stepper (Domino's Progress Tracker) */}
      <BookingStatusStepper status={booking.status as BookingStatus} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Customer Details & Map View */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Customer Header Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6 pb-6 border-b border-border">
              <div className="flex items-center gap-4">
                <img
                  src={booking.customerPhoto || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                  alt={booking.customerName}
                  className="w-16 h-16 rounded-2xl object-cover border border-border shrink-0 shadow-md"
                />
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
                  customerId={booking.customerId || "customer-1"}
                  providerId={currentUser?.id || "provider-1"}
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
                  {booking.status}
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
            latitude={booking.destinationLatitude || 15.8497}
            longitude={booking.destinationLongitude || 74.4977}
            providerLatitude={lastPosition?.latitude || booking.providerCurrentLatitude}
            providerLongitude={lastPosition?.longitude || booking.providerCurrentLongitude}
            address={booking.destinationAddress || booking.address}
            landmark={booking.destinationLandmark}
            instructions={booking.destinationInstructions}
            customerName={booking.customerName}
            customerPhone={booking.customerPhone}
          />
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
    </div>
  );
}
