"use client";

import { useState, useRef, useEffect } from "react";
import { ProviderSidebar } from "@/components/provider/layout/ProviderSidebar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Menu, 
  X,
  Search,
  Sun,
  Moon,
  Monitor,
  LayoutDashboard, 
  CalendarDays, 
  MessageSquare, 
  Wrench, 
  User, 
  Bell,
  Settings,
  LogOut,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Video
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useTranslation, LOCALES } from "@/lib/i18n";
import { SITE_NAME } from "@/constants/site";
import { ProviderSearchDropdown } from "@/components/provider/layout/ProviderSearchDropdown";
import { OnboardingTour } from "@/components/common/OnboardingTour";
import { useTourStore } from "@/store/useTourStore";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const { isOnline, toggleOnlineStatus, profile, fetchProviderBookings, fetchProviderServices } = useProviderStore();
  const { currentUser, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useTranslation();
  const { startTour, hasCompletedTour } = useTourStore();

  // Auto-start provider tour on first visit
  useEffect(() => {
    if (currentUser && currentUser.role === "provider") {
      const isCompleted = hasCompletedTour("provider");
      if (!isCompleted) {
        const timer = setTimeout(() => {
          startTour("provider");
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser, startTour, hasCompletedTour]);

  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));
    return () => unsub();
  }, []);

  // Poll bookings/reviews every 10 seconds for real-time updates
  useEffect(() => {
    if (!currentUser || currentUser.role !== "provider") return;

    // Fetch immediately
    fetchProviderBookings();
    fetchProviderServices();

    // Start interval
    const interval = setInterval(() => {
      fetchProviderBookings();
    }, 10000);

    return () => clearInterval(interval);
  }, [currentUser, fetchProviderBookings, fetchProviderServices]);

  // Close search and popovers on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchFocused(false);
      }
      if (langRef.current && !langRef.current.contains(target)) {
        setLangOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(target)) {
        setThemeOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSearchFocused(false);
        setLangOpen(false);
        setThemeOpen(false);
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Redirect unauthorized roles
  useEffect(() => {
    if (!isHydrated) return;

    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (currentUser.role !== "provider") {
      router.push("/");
    }
  }, [currentUser, router, isHydrated]);

  // Auto-close search on route navigation
  useEffect(() => {
    setSearchFocused(false);
    setSearchQuery("");
  }, [pathname]);

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  const mobileBottomNav = [
    { key: "dashboard", href: "/provider", icon: LayoutDashboard },
    { key: "bookings", href: "/provider/bookings", icon: CalendarDays },
    { key: "messages", href: "/provider/messages", icon: MessageSquare },
    { key: "myServices", href: "/provider/services", icon: Wrench },
    { key: "profile", href: "/provider/profile", icon: User },
  ];

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "provider") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-background text-foreground flex flex-col relative">
      
      {/* Backdrop overlay to dismiss search when clicking anywhere */}
      {searchFocused && searchQuery.trim().length > 0 && (
        <div
          onClick={() => setSearchFocused(false)}
          className="fixed inset-0 z-40 bg-black/10 transition-opacity"
        />
      )}

      {/* ── Fixed Top Bar Navbar ─────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 w-full bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <nav className="w-full flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/provider" className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg flex-shrink-0">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shadow-md group-hover:scale-105 transition-transform duration-200">
              <img src="/belconnect.png" alt="BelConnect" className="h-full w-full object-contain p-1 rounded-lg" />
            </div>
            <div className="hidden sm:block">
              <span className="font-heading text-lg font-bold tracking-tight text-foreground block leading-tight">
                {SITE_NAME}
              </span>
              <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 block uppercase tracking-wider">
                {t("serviceProvider.portalTitle")}
              </span>
            </div>
          </Link>

          {/* ═══════ Clean Simple Search Bar ═══════ */}
          <div ref={searchRef} className="hidden lg:block flex-1 max-w-2xl relative">
            <div className={`relative flex items-center rounded-full border-2 transition-all duration-200 ${searchFocused && searchQuery.trim().length > 0
              ? "border-primary bg-card shadow-lg shadow-primary/10"
              : "border-border bg-muted/50 hover:border-primary/40 hover:bg-card hover:shadow-md"
              }`}>
              <Search className={`absolute left-3.5 h-4 w-4 transition-colors duration-200 ${searchFocused ? "text-primary" : "text-muted-foreground"
                }`} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFocused(true);
                }}
                onFocus={() => setSearchFocused(true)}
                className="w-full bg-transparent pl-10 pr-24 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none"
                placeholder={t("serviceProvider.searchPlaceholder")}
                aria-label="Search"
                id="provider-navbar-search-input"
              />
              {/* Search button */}
              <button
                onClick={() => {
                  if (searchQuery.trim()) {
                    router.push(`/provider/bookings`);
                    setSearchFocused(false);
                  }
                }}
                className="absolute right-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
              >
                <Search className="h-3.5 w-3.5" />
                {t("nav.searchButton")}
              </button>
            </div>

            {/* Search dropdown */}
            <ProviderSearchDropdown
              query={searchQuery}
              onClose={() => { setSearchFocused(false); setSearchQuery(""); }}
              isOpen={searchFocused && searchQuery.trim().length > 0}
            />
          </div>

          {/* Right actions — desktop */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0 ml-auto">
            <div className="flex items-center gap-1">
              {/* Language Switcher */}
              <div ref={langRef} className="relative">
                <button
                  onClick={() => {
                    const next = !langOpen;
                    setLangOpen(next);
                    if (next) {
                      setThemeOpen(false);
                      setUserMenuOpen(false);
                      setSearchFocused(false);
                    }
                  }}
                  className="flex h-9 items-center justify-center rounded-full px-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  aria-label="Toggle language"
                  aria-expanded={langOpen}
                >
                  <span className="font-semibold">{LOCALES.find((l) => l.code === locale)?.nativeLabel || "Lang"}</span>
                </button>
                <AnimatePresence>
                  {langOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-36 rounded-xl border border-border bg-card p-1 shadow-lg overflow-hidden z-50"
                    >
                      {LOCALES.map((opt) => (
                        <button
                          key={opt.code}
                          onClick={() => { setLocale(opt.code); setLangOpen(false); }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${locale === opt.code ? "bg-blue-600/10 text-blue-600 font-medium" : "text-foreground hover:bg-muted"
                            }`}
                        >
                          {opt.nativeLabel}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Theme Switcher */}
              <div ref={themeRef} className="relative">
                <button
                  onClick={() => {
                    const next = !themeOpen;
                    setThemeOpen(next);
                    if (next) {
                      setLangOpen(false);
                      setUserMenuOpen(false);
                      setSearchFocused(false);
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  aria-label="Toggle theme"
                  aria-expanded={themeOpen}
                >
                  {theme === "dark" ? <Moon className="h-4 w-4 text-[#D4A017]" /> : theme === "light" ? <Sun className="h-4 w-4 text-[#D4A017]" /> : <Monitor className="h-4 w-4" />}
                </button>
                <AnimatePresence>
                  {themeOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-36 rounded-xl border border-border bg-card p-1 shadow-lg overflow-hidden z-50"
                    >
                      {themeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setTheme(opt.value); setThemeOpen(false); }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${theme === opt.value ? "bg-blue-600/10 text-blue-600 font-medium" : "text-foreground hover:bg-muted"
                            }`}
                        >
                          <opt.icon className="h-4 w-4" />
                          {opt.value === "light" ? t("common.lightMode") : opt.value === "dark" ? t("common.darkMode") : t("common.systemMode")}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Auth CTA or User Profile Avatar */}
            {currentUser || profile.name ? (
              <div ref={userMenuRef} className="relative border-l border-border pl-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !userMenuOpen;
                    setUserMenuOpen(next);
                    if (next) {
                      setLangOpen(false);
                      setThemeOpen(false);
                      setSearchFocused(false);
                    }
                  }}
                  className="flex items-center gap-2.5 p-1 rounded-full hover:bg-muted transition-colors focus:outline-none cursor-pointer"
                >
                  <img
                    src={currentUser?.avatar || profile.photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                    alt={currentUser?.name || profile.name}
                    className="w-9 h-9 rounded-full object-cover border-2 border-blue-600/40 shadow-sm"
                  />
                  <span className="text-xs font-bold text-foreground hidden xl:block max-w-[110px] truncate">
                    {currentUser?.name || profile.name}
                  </span>
                </button>

                {/* Settings button added directly to the right of profile icon */}
                <Link
                  href="/provider/profile"
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    pathname === "/provider/profile"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title="Profile Settings"
                >
                  <Settings className="h-4.5 w-4.5" />
                </Link>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-2xl overflow-hidden z-50 text-xs space-y-1"
                    >
                      <div className="px-3 py-2 border-b border-border/60">
                        <p className="font-bold text-foreground truncate">{currentUser?.name || profile.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{currentUser?.email || profile.email}</p>
                        <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {t("serviceProvider.portalTitle")}
                        </span>
                      </div>

                      <Link
                        href="/provider"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-xl text-foreground hover:bg-muted font-medium transition-colors text-left"
                      >
                        <LayoutDashboard className="h-4 w-4 text-blue-600" />
                        <span>{t("serviceProvider.providerDashboard")}</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          startTour("provider");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium transition-colors cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>{t("tour.takeProductTour")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                          router.push("/");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 font-bold transition-colors cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{t("common.signOut")}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-l border-border pl-3">
                <Link
                  href="/login"
                  className="text-sm font-semibold text-foreground hover:text-blue-600 transition-colors focus:outline-none rounded-md px-3 py-1.5"
                >
                  {t("nav.login")}
                </Link>

                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-all"
                >
                  {t("nav.getStarted")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 lg:hidden ml-auto">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Sidebar Component */}
      <ProviderSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 pt-16 transition-all duration-300">
        <main
          className="flex-1 pt-4 sm:pt-6 pb-24 md:pb-12 px-3 sm:px-6 lg:px-8 transition-all duration-300 lg:ml-[240px]"
        >
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Navigation Bottom Bar (< md) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border px-2 py-1.5 flex items-center justify-around shadow-lg">
        {mobileBottomNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/provider" && pathname.startsWith(item.href));
          const Icon = item.icon;
          const label = t(`serviceProvider.${item.key}`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-bold scale-105"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-blue-600 dark:text-blue-400" : ""}`} />
              <span className="text-[10px] tracking-tight">{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Onboarding Tour Engine */}
      <OnboardingTour />
    </div>
  );
}
