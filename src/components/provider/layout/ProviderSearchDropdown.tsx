"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  CalendarDays, 
  Wrench, 
  Clock, 
  MessageSquare, 
  Star, 
  Wallet, 
  BarChart3, 
  User, 
  Settings, 
  CheckCircle,
  ArrowRight,
  Sparkles,
  Search,
  CheckCircle2,
  PlayCircle
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";

interface ProviderSearchDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
}

const DASHBOARD_PAGES = [
  { label: "Bookings & Job Requests", href: "/provider/bookings", desc: "View & manage service booking requests", keywords: ["bookings", "jobs", "requests", "orders", "accepted", "completed"], icon: CalendarDays },
  { label: "Add New Service", href: "/provider/services/new", desc: "Create a new service offering", keywords: ["services", "add service", "new service", "create"], icon: Wrench },
  { label: "My Services", href: "/provider/services", desc: "Manage published service offerings", keywords: ["services", "my services", "listings", "create service", "rates"], icon: Wrench },
  { label: "Calendar Schedule", href: "/provider/calendar", desc: "View schedule & appointment calendar", keywords: ["calendar", "schedule", "appointments"], icon: CalendarDays },
  { label: "Working Availability", href: "/provider/availability", desc: "Set working hours & available slots", keywords: ["availability", "hours", "shifts", "slots"], icon: Clock },
  { label: "Customer Messages", href: "/provider/messages", desc: "Chat with booking customers", keywords: ["messages", "chat", "inbox", "customers"], icon: MessageSquare },
  { label: "Customer Reviews", href: "/provider/reviews", desc: "Check customer feedback & ratings", keywords: ["reviews", "ratings", "feedback", "stars"], icon: Star },
  { label: "Payouts & Payments", href: "/provider/payments", desc: "Earnings & payout transactions", keywords: ["payments", "payouts", "earnings", "wallet", "transactions"], icon: Wallet },
  { label: "Profile Account", href: "/provider/profile", desc: "Manage provider account profile", keywords: ["profile", "bio", "account"], icon: User },
];

export function ProviderSearchDropdown({ query, isOpen, onClose }: ProviderSearchDropdownProps) {
  const router = useRouter();
  const { bookings, services, updateBookingStatus } = useProviderStore();

  if (!isOpen || !query.trim()) return null;

  const queryTrimmed = query.trim().toLowerCase();

  // 1. Filter Provider Bookings
  const matchingBookings = queryTrimmed
    ? bookings.filter((b) =>
        b.customerName.toLowerCase().includes(queryTrimmed) ||
        b.serviceName.toLowerCase().includes(queryTrimmed) ||
        b.status.toLowerCase().includes(queryTrimmed) ||
        b.address.toLowerCase().includes(queryTrimmed)
      )
    : bookings.slice(0, 3); // show recent 3 if query is empty

  // 2. Filter Provider Services
  const matchingServices = queryTrimmed
    ? services.filter((s) =>
        s.name.toLowerCase().includes(queryTrimmed) ||
        s.category.toLowerCase().includes(queryTrimmed)
      )
    : services.slice(0, 2);

  // 3. Filter Dashboard Pages
  const matchingPages = queryTrimmed
    ? DASHBOARD_PAGES.filter((p) =>
        p.label.toLowerCase().includes(queryTrimmed) ||
        p.keywords.some((k) => k.includes(queryTrimmed))
      )
    : DASHBOARD_PAGES.slice(0, 4);

  const handleSelect = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-border bg-card shadow-2xl p-3 z-50 max-h-[80vh] overflow-y-auto space-y-3"
      >
        {queryTrimmed.length === 0 ? (
          <div className="p-2 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Dashboard Quick Search
              </span>
              <span className="text-[10px] text-blue-600 font-semibold">Search Bookings, Services, Pages</span>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DASHBOARD_PAGES.slice(0, 4).map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.href}
                    onClick={() => handleSelect(p.href)}
                    className="flex flex-col items-start p-2.5 rounded-xl border border-border/70 bg-muted/20 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-left group"
                  >
                    <Icon className="h-4 w-4 text-blue-600 mb-1.5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-foreground truncate w-full">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ── Section A: Matching Provider Bookings ─────────────────────────── */}
        {matchingBookings.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">
                Bookings ({matchingBookings.length})
              </span>
              <button onClick={() => handleSelect("/provider/bookings")} className="text-[10px] text-muted-foreground hover:text-blue-600 font-bold">
                View All →
              </button>
            </div>

            {matchingBookings.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3 text-xs"
              >
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => handleSelect("/provider/bookings")}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{b.customerName}</span>
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">• {b.serviceName}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{b.address}</p>
                </div>

                {/* Instant Booking Acceptance CTA */}
                {b.status === "Requested" ? (
                  <button
                    onClick={() => {
                      updateBookingStatus(b.id, "Accepted");
                    }}
                    className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Accept Request</span>
                  </button>
                ) : b.status === "Accepted" ? (
                  <button
                    onClick={() => {
                      updateBookingStatus(b.id, "Started");
                    }}
                    className="px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold shadow-xs shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    <span>Start Job</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                    {b.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Section B: Matching Provider Published Services ─────────────── */}
        {matchingServices.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider">
                My Services ({matchingServices.length})
              </span>
              <button onClick={() => handleSelect("/provider/services")} className="text-[10px] text-muted-foreground hover:text-purple-600 font-bold">
                Manage Services →
              </button>
            </div>

            {matchingServices.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelect("/provider/services")}
                className="p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3 text-xs cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-foreground">{s.name}</h5>
                    <span className="text-[11px] text-muted-foreground">{s.category} • Base Rate: ₹{s.basePrice}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ACTIVE
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Section C: Matching Provider Dashboard Pages ────────────────── */}
        {matchingPages.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider px-2 block">
              Dashboard Tools & Pages
            </span>
            {matchingPages.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.href}
                  onClick={() => handleSelect(p.href)}
                  className="p-2.5 rounded-xl border border-border/70 bg-card hover:bg-blue-500/10 hover:border-blue-500/30 flex items-center justify-between text-xs font-bold text-foreground cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <div>{p.label}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">{p.desc}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        )}

        {queryTrimmed.length > 0 && matchingBookings.length === 0 && matchingServices.length === 0 && matchingPages.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No dashboard bookings, services, or pages matched "<span className="font-bold text-foreground">{query}</span>".
          </div>
        )}

      </motion.div>
    </AnimatePresence>
  );
}
