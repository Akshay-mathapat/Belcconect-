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
  User, 
  ShieldCheck,
  X,
  Plus,
  HelpCircle
} from "lucide-react";
import { useEffect } from "react";
import { useProviderStore } from "@/store/useProviderStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "@/components/common/LanguageSelector";
import { useOnboardingTour } from "@/components/onboarding/OnboardingContext";

interface ProviderSidebarProps {
  collapsed?: boolean;
  setCollapsed?: (v: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (v: boolean) => void;
}

interface NavItem {
  key: string;
  href: string;
  label?: string;
  icon: any;
  badge?: string;
  tourAttr?: string;
}

const primaryNavItems: NavItem[] = [
  { key: "home", href: "/provider", label: "Home", icon: LayoutDashboard },
  { key: "requests", href: "/provider/bookings?tab=Requested", label: "Requests", icon: Clock, tourAttr: "provider-bookings" },
  { key: "myJobs", href: "/provider/bookings?tab=ACTIVE", label: "My Jobs", icon: CalendarDays },
  { key: "profile", href: "/provider/profile", label: "Profile", icon: User },
];

const secondaryNavItems: NavItem[] = [
  { key: "myServices", href: "/provider/services", label: "My Services", icon: Wrench, tourAttr: "provider-services" },
  { key: "addNewService", href: "/provider/services/new", label: "Add Service", icon: Plus, tourAttr: "add-service" },
  { key: "calendar", href: "/provider/calendar", label: "Calendar", icon: Calendar, tourAttr: "provider-calendar" },
  { key: "availability", href: "/provider/availability", label: "Availability", icon: Clock, tourAttr: "provider-availability" },
  { key: "messages", href: "/provider/messages", label: "Messages", icon: MessageSquare },
  { key: "reviews", href: "/provider/reviews", label: "Reviews", icon: Star },
  { key: "help", href: "/help", label: "Help & Support", icon: HelpCircle },
];

export function ProviderSidebar({ collapsed = false, setCollapsed, mobileOpen = false, setMobileOpen }: ProviderSidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useAuthStore();
  const { profile, syncWithAuthUser } = useProviderStore();
  const { replayTour } = useOnboardingTour();
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

  const checkIsActive = (itemHref: string) => {
    if (itemHref === "/provider") {
      return pathname === "/provider";
    }
    if (itemHref.startsWith("/provider/bookings")) {
      if (pathname !== "/provider/bookings") return false;
      const query = itemHref.split("?")[1];
      if (!query) return true;
      if (typeof window !== "undefined") {
        const search = window.location.search;
        if (search) {
          return search.includes(query);
        }
      }
      return query.includes("Requested");
    }
    if (itemHref === "/provider/services") {
      return (
        pathname === "/provider/services" ||
        (pathname.startsWith("/provider/services/") && !pathname.startsWith("/provider/services/new"))
      );
    }
    return pathname.startsWith(itemHref);
  };

  const renderNavItem = (item: NavItem, isMobile = false) => {
    const isActive = checkIsActive(item.href);
    const Icon = item.icon;
    const translated = t(`serviceProvider.${item.key}`);
    const label = translated && !translated.startsWith("serviceProvider.") ? translated : (item.label || item.key);

    return (
      <Link
        key={item.href}
        href={item.href}
        data-tour={item.tourAttr}
        onClick={isMobile ? handleNavClick : undefined}
        className={`relative flex items-center gap-3 ${
          isMobile ? "px-3.5 py-3" : "px-3 py-2.5"
        } rounded-xl text-xs font-semibold transition-all group ${
          isActive
            ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
            isActive ? "text-white" : "text-foreground/70"
          }`}
        />
        <span className="truncate flex-1">{label}</span>
        {item.badge && (
          <span
            className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isActive
                ? "bg-white/20 text-white"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
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
            {/* Primary Navigation */}
            <div className="space-y-1">
              {primaryNavItems.map((item) => renderNavItem(item, false))}
            </div>

            {/* Secondary Navigation */}
            <div className="pt-2 border-t border-border/40 space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                More
              </div>
              {secondaryNavItems.map((item) => renderNavItem(item, false))}
            </div>

            {/* Quick Guide Replay Entry Point */}
            <button
              type="button"
              onClick={() => replayTour("provider")}
              className="w-full relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition-all cursor-pointer mt-2 border border-primary/20"
            >
              <HelpCircle className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate font-bold">❓ Quick Guide</span>
            </button>
          </nav>
        </div>

        {/* Language Selection Bar in Sidebar */}
        {!collapsed && (
          <div className="px-3 py-2 border-t border-border/40 bg-muted/10 flex items-center justify-between text-xs">
            <span className="text-[11px] font-bold text-muted-foreground">🌐 Language</span>
            <LanguageSelector variant="header" />
          </div>
        )}

        {/* Provider Profile Summary Footer */}
        <div className="p-3 border-t border-border/50 bg-muted/20" id="tour-provider-kyc">
          <Link href="/provider/profile" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center border border-blue-600/30 shrink-0">
              {profile.name ? profile.name.trim().charAt(0).toUpperCase() : "P"}
            </div>
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
                  {/* Primary Navigation */}
                  <div className="space-y-1">
                    {primaryNavItems.map((item) => renderNavItem(item, true))}
                  </div>

                  {/* Secondary Navigation */}
                  <div className="pt-2 border-t border-border/40 space-y-1">
                    <div className="px-3 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      More
                    </div>
                    {secondaryNavItems.map((item) => renderNavItem(item, true))}
                  </div>
                </nav>
              </div>

              <div className="p-3 border-t border-border/50 bg-muted/20 space-y-3">
                <Link href="/provider/profile" onClick={handleNavClick} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center border border-blue-600/30 shrink-0">
                    {profile.name ? profile.name.trim().charAt(0).toUpperCase() : "P"}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-foreground truncate">{profile.name}</span>
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    </div>
                    <span className="text-[10px] text-muted-foreground block truncate">{t("serviceProvider.verifiedPro")}</span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    useAuthStore.getState().logout();
                    if (setMobileOpen) setMobileOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors cursor-pointer"
                >
                  <span className="truncate">{t("common.signOut")}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
