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
  User, 
  ShieldCheck,
  X,
  Plus
} from "lucide-react";
import { useEffect } from "react";
import { useProviderStore } from "@/store/useProviderStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslation } from "@/lib/i18n";

interface ProviderSidebarProps {
  collapsed?: boolean;
  setCollapsed?: (v: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (v: boolean) => void;
}

interface NavItem {
  key: string;
  href: string;
  icon: any;
  badge?: string;
}

const navItems: NavItem[] = [
  { key: "dashboard", href: "/provider", icon: LayoutDashboard },
  { key: "bookings", href: "/provider/bookings", icon: CalendarDays },
  { key: "addNewService", href: "/provider/services/new", icon: Plus },
  { key: "myServices", href: "/provider/services", icon: Wrench },
  { key: "calendar", href: "/provider/calendar", icon: Calendar },
  { key: "availability", href: "/provider/availability", icon: Clock },
  { key: "messages", href: "/provider/messages", icon: MessageSquare },
  { key: "reviews", href: "/provider/reviews", icon: Star },
  { key: "payments", href: "/provider/payments", icon: Wallet },
  { key: "profile", href: "/provider/profile", icon: User },
];

export function ProviderSidebar({ mobileOpen = false, setMobileOpen }: ProviderSidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useAuthStore();
  const { profile, syncWithAuthUser } = useProviderStore();
  const { t } = useTranslation();

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
      <aside
        className="hidden lg:flex fixed left-0 top-16 bottom-0 z-40 bg-card border-r border-border flex-col justify-between shadow-lg h-[calc(100vh-4rem)] w-[240px]"
      >
        <div>
          {/* Spacing on top instead of toggle header */}
          <div className="h-4" />

          {/* Navigation Items */}
          <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
            {navItems.map((item) => {
              const isActive = item.href === "/provider" 
                ? pathname === "/provider" 
                : item.href === "/provider/services"
                  ? pathname === "/provider/services" || (pathname.startsWith("/provider/services/") && !pathname.startsWith("/provider/services/new"))
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              const label = t(`serviceProvider.${item.key}`);

              const tourAttr =
                item.key === "addNewService"
                  ? "add-service"
                  : item.key === "availability"
                  ? "provider-availability"
                  : item.key === "calendar"
                  ? "provider-calendar"
                  : item.key === "bookings"
                  ? "provider-bookings"
                  : item.key === "dashboard"
                  ? "provider-dashboard"
                  : undefined;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={tourAttr}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? "text-white" : "text-foreground/70"
                  }`} />

                  <span className="truncate">{label}</span>

                  {item.badge && (
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
        <div className="p-3 border-t border-border/50 bg-muted/20" id="tour-provider-kyc">
          <Link href="/provider/profile" className="flex items-center gap-3">
            <img
              src={profile.photo}
              alt={profile.name}
              className="w-9 h-9 rounded-full object-cover border border-blue-600/30 shrink-0"
            />
            <div className="overflow-hidden">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-foreground truncate">{profile.name}</span>
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">{t("serviceProvider.verifiedPro")}</span>
            </div>
          </Link>
        </div>
      </aside>

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
                        {t("serviceProvider.portalTitle")}
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

                {/* Spacing instead of toggle */}
                <div className="h-2" />

                <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
                  {navItems.map((item) => {
                    const isActive = item.href === "/provider" 
                      ? pathname === "/provider" 
                      : item.href === "/provider/services"
                        ? pathname === "/provider/services" || (pathname.startsWith("/provider/services/") && !pathname.startsWith("/provider/services/new"))
                        : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    const label = t(`serviceProvider.${item.key}`);

                    const tourAttr =
                      item.key === "addNewService"
                        ? "add-service"
                        : item.key === "availability"
                        ? "provider-availability"
                        : item.key === "calendar"
                        ? "provider-calendar"
                        : item.key === "bookings"
                        ? "provider-bookings"
                        : item.key === "dashboard"
                        ? "provider-dashboard"
                        : undefined;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        data-tour={tourAttr}
                        onClick={handleNavClick}
                        className={`relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-foreground/70"}`} />
                        <span className="truncate flex-1">{label}</span>
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
                    <span className="text-[10px] text-muted-foreground block truncate">{t("serviceProvider.verifiedPro")}</span>
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
