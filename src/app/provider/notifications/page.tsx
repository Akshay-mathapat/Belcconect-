"use client";

import Link from "next/link";
import { Bell, CheckCheck, Trash2, CalendarDays, Wallet, Star, MessageSquare, Info } from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";

export default function NotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useProviderStore();

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "booking": return <CalendarDays className="h-4 w-4 text-blue-500" />;
      case "payment": return <Wallet className="h-4 w-4 text-emerald-500" />;
      case "review": return <Star className="h-4 w-4 text-amber-500 fill-amber-500" />;
      case "message": return <MessageSquare className="h-4 w-4 text-purple-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Notifications & Alerts
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time updates regarding new bookings, payment payouts, customer messages, and reviews.
          </p>
        </div>

        <button
          onClick={markAllNotificationsRead}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold text-[#1F5F5B]"
        >
          <CheckCheck className="h-4 w-4" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => markNotificationRead(n.id)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
              n.isRead 
                ? "bg-card border-border/70 text-muted-foreground" 
                : "bg-[#1F5F5B]/5 border-[#1F5F5B]/30 text-foreground font-medium shadow-sm"
            }`}
          >
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border shrink-0">
              {getNotifIcon(n.type)}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground">{n.title}</h3>
                <span className="text-[10px] text-muted-foreground">{n.timestamp}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>

              {n.link && (
                <Link href={n.link} className="inline-block text-[11px] font-bold text-[#1F5F5B] hover:underline pt-1">
                  View Associated Request →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
