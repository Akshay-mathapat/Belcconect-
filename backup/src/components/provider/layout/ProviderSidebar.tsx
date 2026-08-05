"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Wrench, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Star, 
  Wallet, 
  BarChart3, 
  Bell, 
  User, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  Power,
  X
} from "lucide-react";
import { useEffect } from "react";
import { useProviderStore } from "@/store/useProviderStore";
import { useAuthStore } from "@/store/useAuthStore";

interface ProviderSidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (v: boolean) => void;
}

const navItems = [
  { label: "Dashboard", href: "/provider", icon: LayoutDashboard },
  { label: "Bookings", href: "/provider/bookings", icon: CalendarDays, badge: "2 New" },
  { label: "My Services", href: "/provider/services", icon: Wrench },
  { label: "Calendar", href: "/provider/calendar", icon: Calendar },
  { label: "Availability", href: "/provider/availability", icon: Clock },
  { label: "Messages", href: "/provider/messages", icon: MessageSquare, badge: "1" },
  { label: "Reviews", href: "/provider/reviews", icon: Star },
  { label: "Payments", href: "/provider/payments", icon: Wallet },
  { label: "Analytics", href: "/provider/analytics", icon: BarChart3 },
  { label: "Notifications", href: "/provider/notifications", icon: Bell },
  { label: "Profile", href: "/provider/profile", icon: User },
  { label: "Settings", href: "/provider/settings", icon: Settings },
];

export function ProviderSidebar({ collapsed, setCollapsed, mobileOpen = false, setMobileOpen }: ProviderSidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useAuthStore();
  const { isOnline, toggleOnlineStatus, profile, syncWithAuthUser } = useProviderStore();

  useEffect(() => {
    if (currentUser) {
      syncWithAuthUser({
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone,
        avatar: currentUser.avatar
      });
    }
  }, [currentUser, syncWithAuthUser]);

  const handleNavClick = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop Sidebar (visible on lg screens) */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 270 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="hidden lg:flex fixed left-0 top-16 bottom-0 z-40 bg-card border-r border-border flex-col justify-between shadow-lg h-[calc(100vh-4rem)]"
      >
        <div>
          {/* Online / Offline Status Switch & Collapse Toggle in ONE Row */}
          <div className="p-3 border-b border-border/40 flex items-center gap-2">
            <button
              onClick={toggleOnlineStatus}
              className={`flex-1 py-2 px-3 rounded-xl border flex items-center transition-all ${
                collapsed ? "justify-center" : "justify-between"
              } ${
                isOnline 
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                  : "bg-muted border-border text-muted-foreground"
              }`}
              title={isOnline ? "Online & Ready" : "Offline"}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? "bg-blue-600 animate-pulse" : "bg-gray-400"}`} />
                {!collapsed && (
                  <span className="text-xs font-bold truncate">
                    {isOnline ? "Online & Ready" : "Offline"}
                  </span>
                )}
              </div>
              {!collapsed && (
                <Power className="h-3.5 w-3.5 opacity-70 shrink-0" />
              )}
            </button>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-8 h-8 shrink-0 rounded-lg border border-border bg-muted/40 text-foreground/70 hover:text-foreground flex items-center justify-center transition-colors"
              title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-210px)] custom-scrollbar">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/provider" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? "text-white" : "text-foreground/70"
                  }`} />

                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}

                  {!collapsed && item.badge && (
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Provider Profile Summary Footer */}
        <div className="p-3 border-t border-border/50 bg-muted/20">
          <Link href="/provider/profile" className="flex items-center gap-3">
            <img
              src={profile.photo}
              alt={profile.name}
              className="w-9 h-9 rounded-full object-cover border border-blue-600/30 shrink-0"
            />
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-foreground truncate">{profile.name}</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                </div>
                <span className="text-[10px] text-muted-foreground block truncate">Verified Pro</span>
              </div>
            )}
          </Link>
        </div>
      </motion.aside>

      {/* Mobile Drawer (visible on < lg when mobileOpen is true) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen?.(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide-out Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 w-[280px] z-50 bg-card border-r border-border flex flex-col justify-between shadow-2xl"
            >
              <div>
                <div className="h-16 px-4 flex items-center justify-between border-b border-border">
                  <Link href="/provider" onClick={handleNavClick} className="flex items-center gap-3">
                    <img src="/belconnect.png" alt="BelConnect" className="w-10 h-10 object-contain shrink-0 rounded-xl" />
                    <div>
                      <span className="font-heading font-bold text-lg text-foreground tracking-tight block">
                        BelConnect
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                        Job Provider Portal
                      </span>
                    </div>
                  </Link>

                  <button
                    onClick={() => setMobileOpen?.(false)}
                    className="p-2 rounded-xl border border-border text-foreground hover:bg-muted"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-3 border-b border-border/40">
                  <button
                    onClick={toggleOnlineStatus}
                    className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-between transition-all ${
                      isOnline 
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                        : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-blue-600 animate-pulse" : "bg-gray-400"}`} />
                      <span className="text-xs font-bold">
                        {isOnline ? "Online & Ready" : "Offline"}
                      </span>
                    </div>
                    <Power className="h-3.5 w-3.5 opacity-70" />
                  </button>
                </div>

                <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-210px)] custom-scrollbar">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/provider" && pathname.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleNavClick}
                        className={`relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-foreground/70"}`} />
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="p-3 border-t border-border/50 bg-muted/20">
                <Link href="/provider/profile" onClick={handleNavClick} className="flex items-center gap-3">
                  <img
                    src={profile.photo}
                    alt={profile.name}
                    className="w-10 h-10 rounded-full object-cover border border-blue-600/30 shrink-0"
                  />
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-foreground truncate">{profile.name}</span>
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    </div>
                    <span className="text-[10px] text-muted-foreground block truncate">Verified Pro</span>
                  </div>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
