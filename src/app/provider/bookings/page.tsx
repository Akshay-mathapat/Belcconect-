"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  UserCheck,
  AlertCircle,
  Trash2
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";
import { BookingStatus } from "@/types/provider";
import { useTranslation } from "@/lib/i18n";
import CallButton from "@/components/calls/CallButton";
import ChatButton from "@/components/chat/ChatButton";

function getBookingTimestamp(booking: { date: string; time?: string }) {
  try {
    let dateStr = booking.date;
    if (dateStr === "Today") {
      const d = new Date();
      dateStr = d.toISOString().split("T")[0];
    } else if (dateStr === "Tomorrow") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dateStr = d.toISOString().split("T")[0];
    } else if (dateStr === "Yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      dateStr = d.toISOString().split("T")[0];
    }

    if (!dateStr.includes("-")) {
      const parsed = Date.parse(booking.date + " " + (booking.time || ""));
      if (!isNaN(parsed)) return parsed;
      return 0;
    }

    let timeStr = booking.time || "12:00 AM";
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let hours = 0;
    let minutes = 0;
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
    } else {
      const parts = timeStr.split(":");
      if (parts.length >= 2) {
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
      }
    }

    const [year, month, day] = dateStr.split("-").map((x) => parseInt(x, 10));
    return new Date(year, month - 1, day, hours, minutes).getTime();
  } catch (e) {
    return 0;
  }
}

export default function BookingsManagementPage() {
  const { bookings, updateBookingStatus, deleteBooking, fetchProviderBookings } = useProviderStore();
  const [activeTab, setActiveTab] = useState<string>("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslation();

  const statusFilterTabs = [
    { key: "activeBookings", label: "Active Jobs", value: "ACTIVE" },
    { key: "requested", label: "Requested", value: "Requested" },
    { key: "accepted", label: "Accepted", value: "Accepted" },
    { key: "started", label: "Started", value: "Started" },
    { key: "completed", label: "Completed", value: "Completed" },
    { key: "rejected", label: "Rejected", value: "Rejected" },
    { key: "allBookings", label: "All History", value: "ALL" },
  ];

  useEffect(() => {
    fetchProviderBookings();

    let syncChannel: BroadcastChannel | null = null;
    try {
      syncChannel = new BroadcastChannel("cityconnect-bookings-sync");
      syncChannel.onmessage = (event) => {
        if (event.data?.type === "REFRESH_BOOKINGS") {
          fetchProviderBookings();
        }
      };
    } catch (e) {}

    return () => {
      if (syncChannel) {
        try { syncChannel.close(); } catch (e) {}
      }
    };
  }, [fetchProviderBookings]);

  const filteredBookings = bookings.filter((b) => {
    let matchesTab = true;
    if (activeTab === "ACTIVE") {
      matchesTab = b.status !== "Completed" && b.status !== "ReviewSubmitted" && (b.status as any) !== "Rejected";
    } else if (activeTab === "Completed") {
      matchesTab = b.status === "Completed" || b.status === "ReviewSubmitted";
    } else if (activeTab !== "ALL") {
      matchesTab = b.status === activeTab;
    }
    const matchesSearch = 
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  }).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  const getStatusBadgeStyle = (status: BookingStatus) => {
    switch (status) {
      case "Requested": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "Accepted": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "OnTheWay": return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
      case "Started": return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "Completed": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "PaymentReceived": return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20";
      case "ReviewSubmitted": return "bg-[#D4A017]/10 text-[#D4A017] border-[#D4A017]/20";
      case "Rejected" as any: return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t("serviceProvider.bookingManagement")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t("serviceProvider.bookingManagementDesc")}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("serviceProvider.filterCustomerService")}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {statusFilterTabs.map((tab) => {
          const count = tab.value === "ACTIVE"
            ? bookings.filter(b => b.status !== "Completed" && b.status !== "ReviewSubmitted" && (b.status as any) !== "Rejected").length
            : tab.value === "Completed"
            ? bookings.filter(b => b.status === "Completed" || b.status === "ReviewSubmitted").length
            : tab.value === "ALL"
            ? bookings.length
            : bookings.filter(b => b.status === tab.value).length;
          
          const isActive = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                isActive 
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span>{t(`serviceProvider.${tab.key}`) || tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                isActive ? "bg-white/20 text-white" : "bg-muted text-foreground/70"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-sm font-bold text-foreground mb-1">{t("serviceProvider.noBookingsFound")}</h3>
            <p className="text-xs text-muted-foreground">{t("serviceProvider.noBookingsFoundDesc")}</p>
          </div>
        ) : (
          filteredBookings.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                
                {/* Left: Customer & Service Meta */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xl flex items-center justify-center border border-border shrink-0 shadow-sm">
                    {b.customerName ? b.customerName.trim().charAt(0).toUpperCase() : "C"}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">{b.id}</span>
                      <span className="text-xs font-extrabold text-foreground">{b.customerName}</span>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${getStatusBadgeStyle(b.status)}`}>
                        {t(`account.statuses.${b.status}`) || b.status}
                      </span>
                    </div>

                    <h3 className="font-heading text-base font-bold text-[#1F5F5B] truncate">
                      {b.serviceName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-foreground/60" />
                        {b.date} {t("common.at") || "at"} {b.time}
                      </span>
                      <span className="flex items-center gap-1 truncate max-w-md">
                        <MapPin className="h-3.5 w-3.5 text-foreground/60 shrink-0" />
                        <span className="truncate">{b.address}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 border-t lg:border-t-0 pt-4 lg:pt-0 border-border">

                  <div className="flex flex-wrap items-center gap-2">
                    <CallButton
                      bookingId={b.id}
                      bookingStatus={b.status}
                      title={t("account.callProvider")}
                    />

                    <ChatButton
                      customerId={b.customerId || (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "customer-1" : "")}
                      providerId={b.providerId || (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "provider-1" : "")}
                      bookingId={b.id}
                      peerName={b.customerName}
                      serviceName={b.serviceName}
                      bookingStatus={b.status}
                      title={t("common.chat")}
                    />

                    {b.status === "Requested" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateBookingStatus(b.id, "Accepted")}
                          className="px-4 py-2 rounded-xl bg-[#1F5F5B] hover:bg-[#164744] text-white text-xs font-bold shadow-sm transition-all"
                        >
                          {t("serviceProvider.accept")}
                        </button>
                        <button
                          onClick={() => updateBookingStatus(b.id, "Rejected")}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all"
                        >
                          {t("serviceProvider.reject")}
                        </button>
                      </div>
                    )}

                    {b.status === "Accepted" && (
                      <button
                        onClick={() => updateBookingStatus(b.id, "Started")}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all"
                      >
                        {t("serviceProvider.startJob")}
                      </button>
                    )}

                    {b.status === "Started" && (
                      <button
                        onClick={() => updateBookingStatus(b.id, "Completed")}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                      >
                        {t("serviceProvider.completeService")}
                      </button>
                    )}

                    {(b.status === "Completed" || b.status === "ReviewSubmitted") && (
                      <button
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this completed service record?")) {
                            deleteBooking(b.id);
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Delete Completed Service"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}

                    <Link
                      href={`/provider/bookings/${b.id}`}
                      className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <span>{t("serviceProvider.details")}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

              </div>
            </motion.div>
          ))
        )}
      </div>

    </div>
  );
}
