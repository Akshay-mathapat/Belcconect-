"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Calendar, Sparkles, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  bookingId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { currentUser } = useAuthStore();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userId = currentUser?.id || (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "customer-1" : "");

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
        headers: { "x-user-id": userId }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // 3-second live sync interval for real-time notification badge updates
    const interval = setInterval(fetchNotifications, 3000);
    return () => clearInterval(interval);
  }, [userId]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (notifId: string, bookingId?: string | null) => {
    try {
      // Optimistic UI update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );

      await fetch(`/api/notifications/${notifId}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      }).catch(() => {
        // Fallback to main patch route
        fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notifId })
        });
      });

      setIsOpen(false);
      if (bookingId) {
        router.push("/account");
      }
    } catch (e) {
      console.error("Error marking notification read:", e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, userId })
      });
    } catch (e) {
      console.error("Error marking all read:", e);
    }
  };

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none cursor-pointer"
        aria-label="Notifications"
        title="In-App Notifications"
        suppressHydrationWarning
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-extrabold text-white shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-50 text-xs"
          >
            {/* Header */}
            <div className="p-3.5 bg-card border-b border-border/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <Bell className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-foreground text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-extrabold text-[10px]">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  suppressHydrationWarning
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border/40 scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Bell className="w-8 h-8 opacity-30 text-muted-foreground" />
                  <p className="font-semibold text-xs">No notifications yet</p>
                  <p className="text-[11px] opacity-70">Updates about your bookings will appear here.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif.id, notif.bookingId)}
                    className={`p-3.5 transition-colors cursor-pointer flex gap-3 items-start ${
                      !notif.isRead ? "bg-blue-500/5 hover:bg-blue-500/10" : "hover:bg-muted/50 opacity-90"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 shrink-0 mt-0.5">
                      {notif.type === "booking_confirmed" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-blue-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`font-bold truncate text-xs ${!notif.isRead ? "text-foreground font-extrabold" : "text-foreground/80"}`}>
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                        {notif.body}
                      </p>
                      <p className="text-[9px] text-muted-foreground/70 mt-1.5 font-medium">
                        {new Date(notif.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
