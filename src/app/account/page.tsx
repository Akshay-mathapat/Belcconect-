"use client";

import { useState, useRef, useEffect } from "react";
import Footer from "@/components/sections/Footer";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  MapPin,
  Calendar,
  Star,
  Clock,
  LogOut,
  Plus,
  Trash2,
  Camera,
  Lock,
  CheckCircle2,
  AlertCircle,
  Building,
  Home as HomeIcon,
  Sparkles,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function AccountPage() {
  const router = useRouter();
  const { currentUser, updateProfile, addAddress, deleteAddress, logout, fetchUserBookings } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"bookings" | "addresses" | "profile">("bookings");

  useEffect(() => {
    if (currentUser) {
      // Legacy session cleanup: if user holds an outdated pre-split ID, force relogin
      if (currentUser.id.startsWith("user-") && currentUser.id !== "customer-1") {
        logout();
        router.push("/login");
        return;
      }
      fetchUserBookings();
    }
  }, [fetchUserBookings, currentUser?.id, router, logout]);

  // Profile Settings Form State
  const [name, setName] = useState(currentUser?.name || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Address Modal State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressType, setAddressType] = useState("Home");
  const [addressText, setAddressText] = useState("");

  // Reschedule Modal State
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Sync state if currentUser changes
  const activeUser = currentUser || {
    id: "guest",
    email: "guest@belconnect.com",
    name: "Guest User",
    phone: "+91 98765 43210",
    role: "user" as const,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    addresses: [],
    bookings: []
  };

  // Handle Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ name, phone });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Handle Add Address Submit
  const handleAddAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressText.trim()) return;
    addAddress({ type: addressType, text: addressText.trim() });
    setAddressText("");
    setShowAddressModal(false);
  };

  // Handle Cancel Booking
  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled" })
      });
      if (res.ok) {
        fetchUserBookings();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to cancel booking");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Network error. Could not cancel booking.");
    }
  };

  // Handle Reschedule Submit
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBookingId || !rescheduleDate || !rescheduleTime) return;
    setIsRescheduling(true);
    try {
      const res = await fetch(`/api/bookings/${rescheduleBookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: rescheduleDate, time: rescheduleTime })
      });
      if (res.ok) {
        fetchUserBookings();
        setShowRescheduleModal(false);
        setRescheduleBookingId(null);
        setRescheduleDate("");
        setRescheduleTime("");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to reschedule booking");
      }
    } catch (error) {
      console.error("Error rescheduling booking:", error);
      alert("Network error. Could not reschedule booking.");
    } finally {
      setIsRescheduling(false);
    }
  };

  // Handle Rebook Redirect
  const handleRebook = (serviceName: string) => {
    router.push(`/book?pro=1&service=${encodeURIComponent(serviceName)}`);
  };

  // Handle Rate Service Dialog
  const handleRateService = (bookingId: string) => {
    const rating = prompt("Rate this service from 1 to 5 stars:");
    if (!rating) return;
    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      alert("Please enter a valid rating between 1 and 5.");
      return;
    }
    alert(`Thank you! You rated Booking ${bookingId} with ${ratingNum} stars.`);
  };

  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <div className="flex-1 pt-8 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 space-y-4 shrink-0">
              
              {/* Reduced Blue Profile Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl flex flex-col items-center text-center gap-3">
                <div className="relative">
                  <img
                    src={activeUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                    alt={activeUser.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-white/30 shadow-md"
                  />
                </div>
                <div className="overflow-hidden w-full">
                  <h2 className="text-lg font-bold font-heading truncate">
                    {activeUser.name}
                  </h2>
                  <p className="text-blue-100 text-xs truncate mt-0.5">
                    {activeUser.email}
                  </p>
                  <p className="text-blue-100 text-xs truncate">
                    {activeUser.phone || "No phone added"}
                  </p>
                  <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
                    {activeUser.role === "provider" ? "Service Provider" : activeUser.role === "job_provider" ? "Employer" : "Customer"}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("bookings")}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === "bookings"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Calendar className="h-4 w-4" />
                    My Bookings
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    activeTab === "bookings" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {activeUser.bookings?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("addresses")}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === "addresses"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <MapPin className="h-4 w-4" />
                    Saved Addresses
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    activeTab === "addresses" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {activeUser.addresses?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === "profile"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <User className="h-4 w-4" />
                  Profile Settings
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
              {/* TAB 1: MY BOOKINGS */}
              {activeTab === "bookings" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">My Bookings</h2>
                      <p className="text-sm text-muted-foreground">Track and manage your requested services</p>
                    </div>
                  </div>

                  {!activeUser.bookings || activeUser.bookings.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-3xl border border-border bg-card p-10 text-center space-y-4 shadow-sm"
                    >
                      <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                        <Calendar className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground">No Service Bookings Yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        You have not placed any service orders. Browse our top local technicians, plumbers, and home cleaners in Belagavi!
                      </p>
                      <Link
                        href="/services"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all"
                      >
                        <Sparkles className="w-4 h-4" />
                        Explore & Book Services
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      {activeUser.bookings.map((booking) => (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-border bg-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                        >
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  booking.status === "Accepted" || booking.status === "OnTheWay" || booking.status === "Started"
                                    ? "bg-teal-500/10 text-teal-600 dark:text-teal-400"
                                    : booking.status === "Requested" || booking.status === "Upcoming"
                                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                    : booking.status === "Completed"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-rose-500/10 text-rose-600"
                                }`}
                              >
                                {booking.status}
                              </span>
                              <span className="text-xs font-mono font-bold text-muted-foreground">
                                ID: {booking.id}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-foreground">{booking.service}</h3>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-blue-600" />
                              Provider: <span className="font-semibold text-foreground">{booking.provider}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-blue-600" />
                              Scheduled: <span className="font-semibold text-foreground">{booking.date}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {["Upcoming", "Requested", "Accepted", "OnTheWay", "Started"].includes(booking.status) ? (
                              <>
                                <button
                                  onClick={() => {
                                    setRescheduleBookingId(booking.id);
                                    setShowRescheduleModal(true);
                                  }}
                                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="px-4 py-2 rounded-xl border border-rose-500/20 text-rose-500 text-xs font-semibold hover:bg-rose-500/10 transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleRebook(booking.service)}
                                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                                >
                                  Rebook
                                </button>
                                {booking.status === "Completed" && (
                                  <button
                                    onClick={() => handleRateService(booking.id)}
                                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <Star className="h-3.5 w-3.5" /> Rate Service
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SAVED ADDRESSES */}
              {activeTab === "addresses" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Saved Addresses</h2>
                      <p className="text-sm text-muted-foreground">Manage your delivery and service addresses</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(true)}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> Add New Address
                    </button>
                  </div>

                  {/* Add Address Modal */}
                  <AnimatePresence>
                    {showAddressModal && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                      >
                        <motion.div
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0.95 }}
                          className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
                        >
                          <div className="flex items-center justify-between border-b border-border/60 pb-3">
                            <h3 className="text-lg font-bold text-foreground">Add New Address</h3>
                            <button
                              onClick={() => setShowAddressModal(false)}
                              className="text-muted-foreground hover:text-foreground text-sm font-bold"
                            >
                              ✕
                            </button>
                          </div>

                          <form onSubmit={handleAddAddressSubmit} className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                Address Type
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {["Home", "Office", "Other"].map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => setAddressType(t)}
                                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                      addressType === t
                                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                        : "bg-muted/40 border-border text-foreground hover:bg-muted"
                                    }`}
                                  >
                                    {t === "Home" ? <HomeIcon className="w-3.5 h-3.5" /> : <Building className="w-3.5 h-3.5" />}
                                    {t}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                Street Address & Area
                              </label>
                              <textarea
                                required
                                rows={3}
                                value={addressText}
                                onChange={(e) => setAddressText(e.target.value)}
                                placeholder="123 Main Street, Tilakwadi, Belagavi, 590006"
                                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-sm text-foreground focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setShowAddressModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-md"
                              >
                                Save Address
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!activeUser.addresses || activeUser.addresses.length === 0 ? (
                    <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-3">
                      <MapPin className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                      <p className="text-sm font-semibold text-foreground">No saved addresses yet</p>
                      <p className="text-xs text-muted-foreground">Add your home or workplace address for faster service checkout</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {activeUser.addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="rounded-2xl border border-border bg-card p-5 relative shadow-sm hover:border-blue-600/40 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-bold">
                              {addr.type === "Home" ? <HomeIcon className="h-3.5 w-3.5" /> : <Building className="h-3.5 w-3.5" />}
                              {addr.type}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteAddress(addr.id)}
                              className="text-muted-foreground hover:text-rose-600 p-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete address"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{addr.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PROFILE SETTINGS */}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Profile Settings</h2>
                    <p className="text-sm text-muted-foreground">Update your personal account details and picture</p>
                  </div>

                  {saveSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>Profile updated successfully!</span>
                    </motion.div>
                  )}

                  <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-6 max-w-2xl shadow-sm">
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your Full Name"
                          className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm text-foreground outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Mobile Number
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm text-foreground outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Email Address
                          </label>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                            <Lock className="w-3 h-3 text-amber-500" /> Cannot be changed
                          </span>
                        </div>
                        <input
                          type="email"
                          disabled
                          readOnly
                          value={activeUser.email}
                          className="w-full px-4 py-3 border border-border/80 rounded-xl bg-muted/60 text-muted-foreground font-mono text-xs cursor-not-allowed outline-none select-none"
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          className="px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-md shadow-blue-600/25 transition-all cursor-pointer"
                        >
                          Save Profile Changes
                        </button>
                      </div>
                    </form>

                    {/* Clean Logout Section Inside Profile Settings */}
                    <div className="pt-6 border-t border-border/60">
                      <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400">Account Session</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">Sign out of your active BelConnect account on this browser</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            logout();
                            router.push("/");
                            router.refresh();
                          }}
                          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reschedule Modal Overlay */}
      <AnimatePresence>
        {showRescheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-card border border-border rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 text-foreground"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-heading text-lg font-bold text-foreground">Reschedule Service</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleBookingId(null);
                  }}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Close reschedule modal"
                >
                  <Trash2 className="w-4 h-4 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    New Date
                  </label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm text-foreground focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    New Time Slot
                  </label>
                  <select
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm text-foreground focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  >
                    <option value="">Select a time slot</option>
                    <option value="09:00 AM">09:00 AM - 11:00 AM</option>
                    <option value="11:00 AM">11:00 AM - 01:00 PM</option>
                    <option value="01:00 PM">01:00 PM - 03:00 PM</option>
                    <option value="03:00 PM">03:00 PM - 05:00 PM</option>
                    <option value="05:00 PM">05:00 PM - 07:00 PM</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRescheduleModal(false);
                      setRescheduleBookingId(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRescheduling}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isRescheduling ? "Updating..." : "Confirm Reschedule"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </main>
  );
}
