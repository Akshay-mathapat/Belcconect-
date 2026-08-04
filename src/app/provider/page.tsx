"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  CalendarDays, 
  Clock, 
  CheckCircle2, 
  Star, 
  AlertCircle, 
  PlusCircle, 
  ArrowUpRight, 
  MessageSquare, 
  ChevronRight,
  Wrench,
  Inbox,
  PlayCircle,
  CheckCircle,
  MapPin,
  Phone,
  ArrowRight,
  HelpCircle,
  CreditCard,
  ShieldCheck,
  PackageCheck,
  Droplets,
  Zap,
  Sparkles,
  CalendarX
} from "lucide-react";
import { useEffect, useState } from "react";
import { useProviderStore } from "@/store/useProviderStore";
import { useAuthStore } from "@/store/useAuthStore";

export default function ProviderDashboardPage() {
  const { currentUser } = useAuthStore();
  const { profile, bookings, services, updateBookingStatus, syncWithAuthUser, fetchProviderBookings, fetchProviderServices } = useProviderStore();
  const [showAllServices, setShowAllServices] = useState(false);

  useEffect(() => {
    if (currentUser) {
      syncWithAuthUser({
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone,
        avatar: currentUser.avatar
      });
    }
    fetchProviderBookings();
    fetchProviderServices();
  }, [currentUser, syncWithAuthUser, fetchProviderBookings, fetchProviderServices]);

  const totalBookings = bookings.length;
  const pendingRequests = bookings.filter((b) => b.status === "Requested").length;
  const acceptedJobs = bookings.filter((b) => b.status === "Accepted" || b.status === "Started" || b.status === "OnTheWay").length;
  const completedServices = bookings.filter((b) => b.status === "Completed" || b.status === "ReviewSubmitted" || b.status === "PaymentReceived").length;
  const todayJobs = bookings.filter((b) => b.date === "Today");

  const displayedServices = showAllServices ? services : services.slice(0, 2);

  return (
    <div className="space-y-6">
      
      {/* ── 1. Good Morning Welcome Banner (Matching Image 2) ────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-blue-200 bg-white/10 px-3 py-1 rounded-full border border-white/20">
              VERIFIED EXPERT
            </span>
            <span className="text-xs text-blue-100 font-medium">| Belagavi Zone</span>
          </div>

          <div>
            <h1 className="font-heading text-2xl sm:text-4xl font-extrabold tracking-tight">
              Good Morning, {profile.name.split(" ")[0]} 👋
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-blue-100 max-w-xl leading-relaxed">
              You have <span className="font-bold text-white underline">{services.length} active services</span> and <span className="font-bold text-white underline">{pendingRequests} pending booking requests</span>.
            </p>
          </div>

          {/* Banner Action Buttons Below Text */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/provider/services/new"
              className="inline-flex items-center gap-2 bg-white text-blue-900 hover:bg-blue-50 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all hover:scale-105"
            >
              <PlusCircle className="h-4 w-4 text-blue-700" />
              <span>Add New Service</span>
            </Link>

            <Link
              href="/provider/bookings"
              className="inline-flex items-center gap-2 bg-blue-600/30 hover:bg-blue-600/50 text-white px-4 py-2.5 rounded-xl font-semibold text-xs border border-white/20 backdrop-blur-sm transition-all"
            >
              <span>View Bookings</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── 2. Recent Bookings (Dashed Border Empty Box matching Image 2) ────── */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              <span>Recent Bookings</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Fast service booking status updates and job progress completion</p>
          </div>
          <Link 
            href="/provider/bookings" 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-500/10 hover:bg-blue-500/20 px-3.5 py-1.5 rounded-xl border border-blue-500/20 transition-all cursor-pointer"
          >
            <span>View All Bookings ({bookings.length})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {bookings.length > 0 ? (
          <div className="space-y-3">
            {bookings.slice(0, 4).map((booking) => (
              <div
                key={booking.id}
                className="rounded-xl border border-border/80 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card hover:bg-muted/30 transition-all shadow-xs"
              >
                <div className="flex items-start gap-3.5">
                  <img
                    src={booking.customerPhoto}
                    alt={booking.customerName}
                    className="w-11 h-11 rounded-full object-cover border border-border shrink-0 shadow-xs"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-xs">{booking.customerName}</span>
                      <span className="text-[11px] text-muted-foreground">• {booking.distance}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                        booking.status === "Requested" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                        booking.status === "Accepted" ? "bg-sky-500/10 text-sky-600 border border-sky-500/20" :
                        booking.status === "OnTheWay" || booking.status === "Started" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" :
                        booking.status === "Completed" || booking.status === "ReviewSubmitted" || booking.status === "PaymentReceived" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                        booking.status === "Rejected" ? "bg-rose-500/10 text-rose-600 border border-rose-500/20" :
                        "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {booking.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400">{booking.serviceName}</h4>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                      <span>{booking.address}</span>
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-blue-600" />
                        {booking.date} at {booking.time}
                      </span>
                      {booking.customerPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-blue-600" />
                          {booking.customerPhone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                  <span className="text-xs font-extrabold text-foreground mr-1">₹{booking.price}</span>

                  {booking.status === "Requested" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateBookingStatus(booking.id, "Accepted")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => updateBookingStatus(booking.id, "Rejected")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                      >
                        <CalendarX className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}

                  {booking.status === "Accepted" && (
                    <button
                      onClick={() => updateBookingStatus(booking.id, "Started")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>Start Job</span>
                    </button>
                  )}

                  {(booking.status === "Started" || booking.status === "OnTheWay") && (
                    <button
                      onClick={() => updateBookingStatus(booking.id, "Completed")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Complete Service</span>
                    </button>
                  )}

                  {(booking.status === "Completed" || booking.status === "ReviewSubmitted") && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold text-xs border border-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Dashed Border Container matching Image 2 */
          <div className="py-10 px-6 text-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/10">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Inbox className="h-7 w-7 text-blue-600" />
            </div>
            <h4 className="text-sm font-bold text-foreground mb-1">No Recent Bookings</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4 leading-relaxed">
              Once customers in Belagavi book your services, incoming booking requests will appear here with instant completion controls.
            </p>
            <Link
              href="/provider/services/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all hover:scale-105"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create New Service</span>
            </Link>
          </div>
        )}
      </motion.div>

      {/* ── 3. Services & Today's Schedule Overview Grid ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Published Services */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">Your Published Services</h3>
                <p className="text-xs text-muted-foreground">Active service offerings listed on BelConnect</p>
              </div>
              <Link
                href="/provider/services/new"
                className="text-xs font-bold text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 px-3.5 py-1.5 rounded-xl border border-blue-500/20 transition-colors"
              >
                + Create Service
              </Link>
            </div>

            {services.length > 0 ? (
              <div className="space-y-3">
                {displayedServices.map((srv) => (
                  <div key={srv.id} className="flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        {srv.category.toLowerCase().includes("cleaning") ? (
                          <Wrench className="h-5 w-5" />
                        ) : srv.category.toLowerCase().includes("plumbing") ? (
                          <Droplets className="h-5 w-5" />
                        ) : (
                          <Zap className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-foreground">{srv.name}</h4>
                        <p className="text-[11px] text-muted-foreground">
                          {srv.category} • Base Rate: ₹{srv.basePrice} • 4.9 ★ (120)
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-wide">
                      ACTIVE
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center rounded-xl border border-dashed border-border bg-muted/10">
                <Wrench className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground mb-1">No Services Added Yet</h4>
                <p className="text-[11px] text-muted-foreground mb-3 max-w-sm mx-auto">Create your first service offering to start receiving customer bookings in Belagavi.</p>
                <Link
                  href="/provider/services/new"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add Your First Service
                </Link>
              </div>
            )}
          </div>

          {services.length > 2 && (
            <button
              onClick={() => setShowAllServices(!showAllServices)}
              className="mt-4 text-xs font-bold text-muted-foreground hover:text-foreground text-center w-full py-1.5 transition-colors"
            >
              {showAllServices ? "↑ Show less services" : `+ Show ${services.length - 2} more services`}
            </button>
          )}
        </div>

        {/* Today's Schedule Widget (Matching Image 2) */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h3 className="font-heading text-base font-bold text-foreground">Today's Schedule</h3>
              <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                {todayJobs.length} Jobs
              </span>
            </div>

            {todayJobs.length > 0 ? (
              <div className="space-y-3">
                {todayJobs.map((b) => (
                  <div key={b.id} className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {b.time}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600">
                        {b.status}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground truncate">{b.serviceName}</h4>
                    <p className="text-[11px] text-muted-foreground truncate">{b.customerName} • {b.address}</p>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty Schedule Matching Image 2 */
              <div className="py-6 text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-2 relative">
                  <CalendarX className="h-7 w-7 text-blue-600" />
                  <CheckCircle2 className="h-4 w-4 text-blue-600 absolute bottom-0 right-0 bg-card rounded-full" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Clear Runway for Today</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  No jobs scheduled for this morning. This might be a good time to update your portfolio or reach out to past clients.
                </p>
              </div>
            )}
          </div>

          {/* Bottom 2 Stat Boxes matching Image 2 */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
              <div className="font-heading text-lg font-extrabold text-blue-600">14</div>
              <span className="text-[9px] font-extrabold text-blue-600/80 tracking-wider uppercase">PROFILE VIEWS</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
              <div className="font-heading text-lg font-extrabold text-blue-600">98%</div>
              <span className="text-[9px] font-extrabold text-blue-600/80 tracking-wider uppercase">RESPONSE RATE</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── 4. Bottom 3 Quick Action / Help Cards Row (NEW FROM IMAGE 2!) ─────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Need Help? */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-3.5 hover:border-blue-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Need Help?</h4>
            <p className="text-[11px] text-muted-foreground">Visit our Help Center for tutorials and platform guides.</p>
          </div>
        </div>

        {/* Card 2: Next Payout */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-3.5 hover:border-blue-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Next Payout</h4>
            <p className="text-[11px] text-muted-foreground">Scheduled for Monday, Oct 14th (₹1,240.00)</p>
          </div>
        </div>

        {/* Card 3: Safety Check */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-3.5 hover:border-blue-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Safety Check</h4>
            <p className="text-[11px] text-muted-foreground">Your credentials are up to date and verified.</p>
          </div>
        </div>

      </div>

    </div>
  );
}
