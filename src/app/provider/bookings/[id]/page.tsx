"use client";

import { use, useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  Upload, 
  StickyNote, 
  ShieldCheck,
  Calendar,
  AlertCircle
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";
import { BookingStatus } from "@/types/provider";

const timelineSteps: BookingStatus[] = [
  "Requested",
  "Accepted",
  "OnTheWay",
  "Started",
  "Completed",
  "PaymentReceived",
  "ReviewSubmitted"
];

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bookings, updateBookingStatus, updateBookingNotes, addBookingBeforeImage, addBookingAfterImage } = useProviderStore();

  const booking = bookings.find((b) => b.id === id) || bookings[0];

  const [notes, setNotes] = useState(booking.internalNotes || "");
  const [savedNotesMessage, setSavedNotesMessage] = useState(false);

  const currentStepIndex = timelineSteps.indexOf(booking.status);

  const handleSaveNotes = () => {
    updateBookingNotes(booking.id, notes);
    setSavedNotesMessage(true);
    setTimeout(() => setSavedNotesMessage(false), 2000);
  };

  const handleBeforeUpload = () => {
    const mockImg = "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80";
    addBookingBeforeImage(booking.id, mockImg);
  };

  const handleAfterUpload = () => {
    const mockImg = "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=400&q=80";
    addBookingAfterImage(booking.id, mockImg);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/provider/bookings"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Bookings</span>
        </Link>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-600/10 text-blue-600 border border-blue-600/20">
          Booking ID: {booking.id}
        </span>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Header Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6 pb-6 border-b border-border">
              <div className="flex items-center gap-4">
                <img
                  src={booking.customerPhoto}
                  alt={booking.customerName}
                  className="w-16 h-16 rounded-2xl object-cover border border-border shrink-0 shadow-md"
                />
                <div>
                  <h1 className="font-heading text-xl font-bold text-foreground">{booking.customerName}</h1>
                  <p className="text-xs text-muted-foreground">{booking.customerPhone}</p>
                  <span className="inline-block text-[11px] font-bold text-blue-600 mt-1">
                    {booking.distance} from your base
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <a
                  href={`tel:${booking.customerPhone}`}
                  className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  <span>Call</span>
                </a>
                <Link
                  href="/provider/messages"
                  className="px-3 py-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-teal-400 hover:bg-blue-600/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </Link>
              </div>
            </div>

            {/* Service & Address info */}
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Service Name</span>
                <h2 className="font-heading text-lg font-bold text-blue-600">{booking.serviceName}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-muted/30 p-3.5 rounded-xl border border-border/50">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-1">Scheduled Time</span>
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-blue-600" />
                    {booking.date} at {booking.time}
                  </span>
                </div>

                <div className="bg-muted/30 p-3.5 rounded-xl border border-border/50">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-1">Agreed Service Price</span>
                  <span className="font-bold text-foreground text-base">₹{booking.price}</span>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-1">Customer Address</span>
                <p className="text-xs text-foreground font-medium flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{booking.address}</span>
                </p>
              </div>

              {booking.problemDescription && (
                <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20">
                  <span className="text-amber-700 dark:text-amber-400 block text-[10px] uppercase font-bold mb-1">Customer Note</span>
                  <p className="text-xs text-foreground italic">"{booking.problemDescription}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Timeline Tracker */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-heading text-base font-bold text-foreground mb-6">Service Status Lifecycle</h3>

            <div className="relative pl-6 border-l-2 border-border space-y-6">
              {timelineSteps.map((step, idx) => {
                const isPassed = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step} className="relative flex items-center justify-between">
                    <span 
                      className={`absolute -left-[31px] w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                        isPassed 
                          ? "bg-blue-600 border-blue-600 text-white" 
                          : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {isPassed ? "✓" : idx + 1}
                    </span>

                    <div>
                      <h4 className={`text-xs font-bold ${isCurrent ? "text-blue-600 text-sm font-extrabold" : "text-foreground"}`}>
                        {step}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {isPassed ? "Completed stage" : "Pending action"}
                      </p>
                    </div>

                    {isCurrent && (
                      <div className="flex items-center gap-2">
                        {step === "Accepted" && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, "OnTheWay")}
                            className="px-3 py-1.5 rounded-lg bg-[#D4A017] text-slate-950 text-xs font-bold"
                          >
                            Mark On The Way
                          </button>
                        )}
                        {step === "OnTheWay" && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, "Started")}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold"
                          >
                            Start Service
                          </button>
                        )}
                        {step === "Started" && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, "Completed")}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                          >
                            Complete Service
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Before & After Photo Upload Showcase */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-heading text-base font-bold text-foreground mb-4">Service Proof & Inspection Photos</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Before Images */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-foreground block">Before Service Photos</span>
                <div className="grid grid-cols-2 gap-2">
                  {booking.beforeImages?.map((img, i) => (
                    <img key={i} src={img} alt="Before" className="w-full h-24 rounded-xl object-cover border border-border" />
                  ))}
                  <button
                    onClick={handleBeforeUpload}
                    className="w-full h-24 rounded-xl border-2 border-dashed border-border hover:border-blue-600 flex flex-col items-center justify-center text-muted-foreground hover:text-blue-600 transition-colors"
                  >
                    <Upload className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-bold">Add Before Photo</span>
                  </button>
                </div>
              </div>

              {/* After Images */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-foreground block">After Service Photos</span>
                <div className="grid grid-cols-2 gap-2">
                  {booking.afterImages?.map((img, i) => (
                    <img key={i} src={img} alt="After" className="w-full h-24 rounded-xl object-cover border border-border" />
                  ))}
                  <button
                    onClick={handleAfterUpload}
                    className="w-full h-24 rounded-xl border-2 border-dashed border-border hover:border-emerald-500 flex flex-col items-center justify-center text-muted-foreground hover:text-emerald-600 transition-colors"
                  >
                    <Upload className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-bold">Add After Photo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Google Maps Placeholder & Internal Notes */}
        <div className="space-y-6">
          
          {/* Map Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-blue-600" />
              Location & Navigation
            </h3>

            {/* Map visual mock */}
            <div className="w-full h-56 rounded-xl bg-slate-200 dark:bg-slate-800 relative overflow-hidden flex flex-col items-center justify-center p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg animate-bounce mb-2">
                <MapPin className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-foreground">{booking.address}</span>
              <span className="text-[10px] text-muted-foreground mt-1">Google Maps API Ready</span>

              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(booking.address)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-[#174946] transition-colors"
              >
                Open in Google Maps
              </a>
            </div>
          </div>

          {/* Internal Notes Pad */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <StickyNote className="h-4 w-4 text-[#D4A017]" />
                Internal Provider Notes
              </h3>
              {savedNotesMessage && (
                <span className="text-[10px] font-bold text-emerald-600">Saved!</span>
              )}
            </div>

            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write private notes about wiring parts required, wire gauges, or customer requests..."
              className="w-full p-3 text-xs rounded-xl bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />

            <button
              onClick={handleSaveNotes}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-[#184e4b] text-white text-xs font-bold transition-colors"
            >
              Save Internal Note
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
