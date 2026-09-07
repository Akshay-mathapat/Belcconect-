"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Bell, 
  Moon, 
  Sun, 
  Check, 
  ExternalLink, 
  X, 
  CalendarDays, 
  Wrench, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Star, 
  Wallet, 
  BarChart3, 
  User, 
  Settings,
  CheckCircle,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  PlusCircle
} from "lucide-react";
import { useTheme } from "next-themes";
import { useProviderStore } from "@/store/useProviderStore";

interface ProviderNavbarProps {
  collapsed: boolean;
}

const QUICK_PAGES = [
  { label: "Dashboard", href: "/provider", keywords: ["dashboard", "home", "main", "overview"], icon: CalendarDays },
  { label: "Bookings", href: "/provider/bookings", keywords: ["bookings", "jobs", "requests", "orders"], icon: CalendarDays },
  { label: "My Services", href: "/provider/services", keywords: ["services", "my services", "listings", "rates", "create service"], icon: Wrench },
  { label: "Calendar", href: "/provider/calendar", keywords: ["calendar", "schedule", "events", "agenda"], icon: Calendar },
  { label: "Availability", href: "/provider/availability", keywords: ["availability", "working hours", "shifts", "days off", "duty"], icon: Clock },
  { label: "Messages", href: "/provider/messages", keywords: ["messages", "chat", "inbox", "customer chat"], icon: MessageSquare },
  { label: "Reviews", href: "/provider/reviews", keywords: ["reviews", "ratings", "feedback", "stars"], icon: Star },
  { label: "Payments", href: "/provider/payments", keywords: ["payments", "payouts", "earnings", "financials", "transactions"], icon: Wallet },
  { label: "Analytics", href: "/provider/analytics", keywords: ["analytics", "performance", "insights", "metrics", "stats"], icon: BarChart3 },
  { label: "Notifications", href: "/provider/notifications", keywords: ["notifications", "alerts", "updates"], icon: Bell },
  { label: "Profile", href: "/provider/profile", keywords: ["profile", "bio", "account", "details"], icon: User },
  { label: "Settings", href: "/provider/settings", keywords: ["settings", "preferences", "config"], icon: Settings },
];

export function ProviderNavbar({ collapsed }: ProviderNavbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { notifications, markAllNotificationsRead, profile, bookings, services, updateBookingStatus } = useProviderStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const queryLower = searchQuery.trim().toLowerCase();

  // Filter Bookings matching search
  const filteredBookings = queryLower
    ? bookings.filter((b) =>
        b.customerName.toLowerCase().includes(queryLower) ||
        b.serviceName.toLowerCase().includes(queryLower) ||
        b.status.toLowerCase().includes(queryLower) ||
        b.address.toLowerCase().includes(queryLower)
      )
    : [];

  // Filter Services matching search
  const filteredServices = queryLower
    ? services.filter((s) =>
        s.name.toLowerCase().includes(queryLower) ||
        s.category.toLowerCase().includes(queryLower)
      )
    : [];

  // Filter Dashboard Pages matching search
  const filteredPages = queryLower
    ? QUICK_PAGES.filter((p) =>
        p.label.toLowerCase().includes(queryLower) ||
        p.keywords.some((k) => k.includes(queryLower))
      )
    : [];

  const hasResults = queryLower.length > 0 && (filteredBookings.length > 0 || filteredServices.length > 0 || filteredPages.length > 0);

  const handleNavigate = (path: string) => {
    router.push(path);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <header 
      className={`fixed top-0 right-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border/60 transition-all duration-300 flex items-center justify-between px-4 sm:px-6 ${
        collapsed ? "left-[80px]" : "left-[270px]"
      }`}
    >
      {/* Search Bar with Live Results Dropdown */}
      <div ref={searchContainerRef} className="relative w-64 sm:w-96">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Search bookings, services, features..."
            className="w-full pl-10 pr-20 py-2 text-xs rounded-xl bg-muted/50 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }}
                className="p-1 rounded-full hover:bg-muted text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-xs cursor-pointer"
            >
              Search
            </button>
          </div>
        </div>

        {/* Live Search Results Dropdown */}
        {isSearchOpen && (
          <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-border bg-card shadow-2xl p-3 z-50 max-h-96 overflow-y-auto space-y-3">
            
            {queryLower.length === 0 ? (
              <div className="p-2 space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Quick Dashboard Shortcuts</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_PAGES.slice(0, 6).map((page) => {
                    const Icon = page.icon;
                    return (
                      <button
                        key={page.href}
                        onClick={() => handleNavigate(page.href)}
                        className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-muted/20 hover:bg-blue-500/10 hover:border-blue-500/30 text-xs font-bold text-foreground text-left transition-all"
                      >
                        <Icon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{page.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : !hasResults ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No matching bookings or dashboard services found for "<span className="font-bold text-foreground">{searchQuery}</span>".
              </div>
            ) : (
              <>
                {/* Bookings Results */}
                {filteredBookings.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider px-2 block">
                      Bookings ({filteredBookings.length})
                    </span>
                    {filteredBookings.map((b) => (
                      <div
                        key={b.id}
                        className="p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/50 flex items-center justify-between gap-3 text-xs"
                      >
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleNavigate(`/provider/bookings`)}
                        >
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <span>{b.customerName}</span>
                            <span className="text-[10px] font-normal text-muted-foreground">• {b.serviceName}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{b.address}</p>
                        </div>

                        {/* Quick Accept Action */}
                        {b.status === "Requested" ? (
                          <button
                            onClick={() => updateBookingStatus(b.id, "Accepted")}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-xs shrink-0 cursor-pointer"
                          >
                            Accept Now
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                            {b.status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Services Results */}
                {filteredServices.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider px-2 block">
                      Published Services ({filteredServices.length})
                    </span>
                    {filteredServices.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleNavigate(`/provider/services`)}
                        className="p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/50 flex items-center justify-between gap-2 text-xs cursor-pointer"
                      >
                        <div>
                          <h5 className="font-bold text-foreground">{s.name}</h5>
                          <span className="text-[11px] text-muted-foreground">{s.category} • Mutual Pricing</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dashboard Navigation Pages Results */}
                {filteredPages.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider px-2 block">
                      Dashboard Pages
                    </span>
                    {filteredPages.map((p) => {
                      const Icon = p.icon;
                      return (
                        <div
                          key={p.href}
                          onClick={() => handleNavigate(p.href)}
                          className="p-2 rounded-xl border border-border/60 bg-muted/20 hover:bg-blue-500/10 flex items-center justify-between text-xs font-bold text-foreground cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-blue-600" />
                            <span>{p.label}</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Customer Site Portal Link */}
        <Link
          href="/"
          target="_blank"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground/80 transition-colors"
        >
          <span>Customer Site</span>
          <ExternalLink className="h-3 w-3" />
        </Link>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-9 h-9 rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Toggle Theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 text-[#D4A017]" /> : <Moon className="h-4 w-4 text-blue-600" />}
        </button>

        {/* Notifications Bell with Quick Accept Action */}
        <div className="relative">
          <button
            onClick={() => setShowNotifPopover(!showNotifPopover)}
            className="relative w-9 h-9 rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="h-4 w-4 text-foreground/80" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Popover */}
          {showNotifPopover && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                <h4 className="text-xs font-bold text-foreground">Notifications</h4>
                <button
                  onClick={markAllNotificationsRead}
                  className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Mark all as read
                </button>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin">
                {notifications.slice(0, 4).map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-xl border text-xs ${
                      n.isRead ? "bg-card border-border/50 text-muted-foreground" : "bg-blue-500/10 border-blue-500/30 text-foreground font-medium"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground">{n.title}</span>
                      <span className="text-[10px] text-muted-foreground">{n.timestamp}</span>
                    </div>
                    <p className="text-xs leading-relaxed mb-2">{n.message}</p>
                    
                    <div className="flex items-center justify-between pt-1">
                      {n.link && (
                        <Link href={n.link} onClick={() => setShowNotifPopover(false)} className="text-[11px] font-semibold text-blue-600 hover:underline">
                          View Details →
                        </Link>
                      )}

                      {/* Quick Accept CTA inside Notification */}
                      {n.title.toLowerCase().includes("booking") && (
                        <button
                          onClick={() => {
                            router.push(n.link || "/provider/bookings");
                            setShowNotifPopover(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-xs cursor-pointer ml-auto"
                        >
                          View Booking
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-border mt-3 text-center">
                <Link
                  href="/provider/notifications"
                  onClick={() => setShowNotifPopover(false)}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  See All Notifications
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <Link href="/provider/profile" className="flex items-center gap-2 pl-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center border-2 border-blue-600/30 shadow-sm shrink-0">
            {profile.name ? profile.name.trim().charAt(0).toUpperCase() : "P"}
          </div>
        </Link>
      </div>
    </header>
  );
}
