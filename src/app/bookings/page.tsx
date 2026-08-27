"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Calendar, Clock, MapPin, ChevronRight, User, ShieldCheck, 
  Sparkles, AlertCircle, PhoneCall, Radio, CheckCircle2, Trash2 
} from "lucide-react";
import { Booking } from "@/types/provider";
import { useTranslation } from "@/lib/i18n";
import CallButton from "@/components/calls/CallButton";

const statusBadgeStyles: Record<string, string> = {
  Requested: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Accepted: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  OnTheWay: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 animate-pulse",
  Started: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  Completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Rejected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
};

export default function CustomerBookingsPage() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "COMPLETED" | "ALL">("ACTIVE");

  useEffect(() => {
    async function fetchBookings() {
      try {
        const userId = typeof window !== "undefined" ? localStorage.getItem("cityconnect_user_id") || "customer-1" : "customer-1";
        const res = await fetch("/api/bookings", {
          headers: { "x-user-id": userId }
        });
        if (!res.ok) throw new Error("Failed to fetch bookings");
        const data = await res.json();
        setBookings(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("Error loading customer bookings:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchBookings();
    const interval = setInterval(fetchBookings, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteBooking = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this completed service record?")) {
      try {
        await fetch(`/api/bookings/${id}`, { method: "DELETE" });
        setBookings((prev) => prev.filter((b) => b.id !== id));
      } catch (e) {
        console.error("Error deleting booking:", e);
      }
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === "ACTIVE") {
      return b.status !== "Completed" && b.status !== "ReviewSubmitted" && (b.status as any) !== "Rejected";
    }
    if (activeTab === "COMPLETED") {
      return b.status === "Completed" || b.status === "ReviewSubmitted";
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Customer Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-foreground tracking-tight mt-1">
              My Bookings & Live Tracking
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Track active service providers live on map and review past service history
            </p>
          </div>

          <Link
            href="/services"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4" />
            <span>Book New Service</span>
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          {[
            { label: "Active Orders", value: "ACTIVE", count: bookings.filter(b => b.status !== "Completed" && b.status !== "ReviewSubmitted" && (b.status as any) !== "Rejected").length },
            { label: "Completed", value: "COMPLETED", count: bookings.filter(b => b.status === "Completed" || b.status === "ReviewSubmitted").length },
            { label: "All History", value: "ALL", count: bookings.length }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                activeTab === tab.value
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                activeTab === tab.value ? "bg-white/20 text-white" : "bg-muted text-foreground/70"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-muted-foreground">Fetching your bookings...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold text-center">
            {error}
          </div>
        )}

        {/* Empty Bookings State */}
        {!loading && !error && filteredBookings.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-foreground">No Bookings Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                {activeTab === "ACTIVE" 
                  ? "You have no active orders in progress. Completed services are stored in the Completed tab."
                  : "No bookings found in this view."}
              </p>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-all"
            >
              <span>Explore Local Services</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Bookings List Cards */}
        {!loading && filteredBookings.length > 0 && (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const isActiveTracking = ["Accepted", "OnTheWay", "Started"].includes(booking.status);
              const isCompleted = booking.status === "Completed" || booking.status === "ReviewSubmitted";

              return (
                <div
                  key={booking.id}
                  className={`rounded-2xl border transition-all bg-card p-5 sm:p-6 shadow-sm hover:shadow-md ${
                    isActiveTracking ? "border-blue-500/40 ring-1 ring-blue-500/20" : "border-border"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left Details */}
                    <div className="space-y-2.5 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-mono font-bold text-muted-foreground uppercase">
                          ID: #{booking.id}
                        </span>

                        <span
                          className={`px-3 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                            statusBadgeStyles[booking.status] || "bg-muted text-foreground border-border"
                          }`}
                        >
                          {isActiveTracking && <Radio className="w-3 h-3 text-blue-500 animate-pulse" />}
                          {booking.status}
                        </span>
                      </div>

                      <h3 className="text-lg font-heading font-extrabold text-foreground">
                        {booking.serviceName}
                      </h3>

                      <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>Provider: <strong className="text-foreground">{booking.providerName}</strong></span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>Date: <strong className="text-foreground">{booking.date} ({booking.time})</strong></span>
                        </div>

                        <div className="flex items-center gap-2 sm:col-span-2">
                          <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="truncate">Address: <strong className="text-foreground">{booking.address}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3 flex-wrap sm:flex-col sm:items-end justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-border/60">
                      {isActiveTracking ? (
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                        >
                          <Radio className="w-4 h-4 animate-pulse text-emerald-300" />
                          <span>Track Live Order</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs border border-border transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Details</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}

                      {isCompleted && (
                        <button
                          onClick={() => handleDeleteBooking(booking.id)}
                          className="px-3.5 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Delete Completed Booking"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}

                      <CallButton
                        bookingId={booking.id}
                        bookingStatus={booking.status}
                        size="md"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
