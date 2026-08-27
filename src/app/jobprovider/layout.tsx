"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  MessageSquare,
  Settings,
  Building2,
  HelpCircle,
  Search,
  Moon,
  Sun,
  Monitor,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslation, LOCALES } from "@/lib/i18n";
import { SITE_NAME } from "@/constants/site";
import { JobProviderSearchDropdown } from "@/components/jobprovider/layout/JobProviderSearchDropdown";

export default function JobProviderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useTranslation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (currentUser.role !== "job_provider") {
      router.push("/");
    }
  }, [currentUser, router]);

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  const allNavItems = [
    { href: "/jobprovider/dashboard", label: t("jobprovider.dashboard") !== "jobprovider.dashboard" ? t("jobprovider.dashboard") : "Dashboard", icon: LayoutDashboard },
    { href: "/jobprovider/jobs", label: t("jobprovider.jobListings") !== "jobprovider.jobListings" ? t("jobprovider.jobListings") : "Job Listings", icon: Briefcase },
    { href: "/jobprovider/candidates", label: t("jobprovider.candidates") !== "jobprovider.candidates" ? t("jobprovider.candidates") : "Candidates", icon: Users },
    { href: "/jobprovider/messages", label: t("jobprovider.messages") !== "jobprovider.messages" ? t("jobprovider.messages") : "Messages", icon: MessageSquare },
    { href: "/jobprovider/settings", label: t("jobprovider.settings") !== "jobprovider.settings" ? t("jobprovider.settings") : "Settings", icon: Settings },
    { href: "/jobprovider/business-profile", label: t("jobprovider.businessProfile") !== "jobprovider.businessProfile" ? t("jobprovider.businessProfile") : "Business Profile", icon: Building2 },
    { href: "/jobprovider/help", label: t("jobprovider.help") !== "jobprovider.help" ? t("jobprovider.help") : "Help", icon: HelpCircle },
  ];

  const handleSelectPanel = (panelKey: string) => {
    setSearchFocused(false);
    setSearchQuery("");
    if (panelKey === "my-jobs") router.push("/jobprovider/jobs");
    else if (panelKey === "applications" || panelKey === "shortlisted") router.push("/jobprovider/candidates");
    else if (panelKey === "messages") router.push("/jobprovider/messages");
    else if (panelKey === "business-profile") router.push("/jobprovider/business-profile");
    else if (panelKey === "settings") router.push("/jobprovider/settings");
    else if (panelKey === "help") router.push("/jobprovider/help");
    else if (panelKey === "post-job") router.push("/jobprovider/post-job");
    else router.push("/jobprovider/dashboard");
  };

  if (!currentUser || currentUser.role !== "job_provider") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-muted/10 text-foreground flex flex-col">
      {/* Backdrop overlay for search focus */}
      {searchFocused && searchQuery.trim().length > 0 && (
        <div
          onClick={() => setSearchFocused(false)}
          className="fixed inset-0 z-40 bg-black/10 transition-opacity"
        />
      )}

      {/* ── Top Bar Navbar ─────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 w-full bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <nav className="w-full flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo with Subtitle */}
          <Link href="/jobprovider/dashboard" className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg flex-shrink-0">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shadow-md group-hover:scale-105 transition-transform duration-200">
              <img src="/belconnect.png" alt="BelConnect" className="h-full w-full object-contain p-1 rounded-lg" />
            </div>
            <div className="hidden sm:block">
              <span className="font-heading text-lg font-bold tracking-tight text-foreground block leading-tight">
                {SITE_NAME}
              </span>
              <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 block uppercase tracking-wider">
                {t("common.jobProviderWorkspace")}
              </span>
            </div>
          </Link>

          {/* ═══════ Search Bar ═══════ */}
          <div ref={searchRef} className="hidden lg:block flex-1 max-w-2xl relative">
            <div className={`relative flex items-center rounded-full border-2 transition-all duration-200 ${
              searchFocused && searchQuery.trim().length > 0
                ? "border-primary bg-card shadow-lg shadow-primary/10"
                : "border-border bg-muted/50 hover:border-primary/40 hover:bg-card hover:shadow-md"
            }`}>
              <Search className={`absolute left-3.5 h-4 w-4 transition-colors duration-200 ${searchFocused ? "text-primary" : "text-muted-foreground"}`} />
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
                placeholder={t("common.searchPlaceholder")}
                aria-label="Search"
                id="jobprovider-navbar-search-input"
              />
              <button
                onClick={() => {
                  if (searchQuery.trim()) {
                    router.push("/jobprovider/jobs");
                    setSearchFocused(false);
                  }
                }}
                className="absolute right-1.5 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
              >
                <Search className="h-3.5 w-3.5" />
                {t("nav.searchButton")}
              </button>
            </div>

            <JobProviderSearchDropdown
              query={searchQuery}
              onClose={() => { setSearchFocused(false); setSearchQuery(""); }}
              isOpen={searchFocused && searchQuery.trim().length > 0}
              onSelectPanel={handleSelectPanel}
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
                  className="flex h-9 items-center justify-center rounded-full px-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors focus:outline-none"
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
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            locale === opt.code ? "bg-blue-600/10 text-blue-600 font-medium" : "text-foreground hover:bg-muted"
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
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none"
                >
                  {theme === "dark" ? <Moon className="h-4 w-4 text-[#D4A017]" /> : theme === "light" ? <Sun className="h-4 w-4 text-[#D4A017]" /> : <Monitor className="h-4 w-4" />}
                </button>
                <AnimatePresence>
                  {themeOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-36 rounded-xl border border-border bg-card p-1 shadow-lg overflow-hidden z-50"
                    >
                      {themeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setTheme(opt.value); setThemeOpen(false); }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            theme === opt.value ? "bg-blue-600/10 text-blue-600 font-medium" : "text-foreground hover:bg-muted"
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

            {/* Profile & Settings */}
            {currentUser && (
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
                    src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                    alt={currentUser.name}
                    className="w-9 h-9 rounded-full object-cover border-2 border-blue-600/40 shadow-sm"
                  />
                  <span className="text-xs font-bold text-foreground block max-w-[110px] truncate">
                    {currentUser.name}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/jobprovider/settings")}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    pathname === "/jobprovider/settings"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title="Settings"
                >
                  <Settings className="h-4.5 w-4.5" />
                </button>

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
                        <p className="font-bold text-foreground truncate">{currentUser.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{currentUser.email}</p>
                        <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {t("common.employer")}
                        </span>
                      </div>

                      <button
                        onClick={() => { router.push("/jobprovider/dashboard"); setUserMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-xl text-foreground hover:bg-muted font-medium transition-colors text-left"
                      >
                        <LayoutDashboard className="h-4 w-4 text-blue-600" />
                        <span>{t("common.jobProviderWorkspace")}</span>
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
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 lg:hidden ml-auto">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted transition-colors"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* ── Main Layout Body ───────────────────────────────────────────── */}
      <div className="flex pt-16 h-screen w-screen overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Left Sidebar Navigation ────────────────────────────────────── */}
        <aside className={`fixed lg:static inset-y-0 left-0 top-16 lg:top-0 z-40 h-[calc(100vh-4rem)] lg:h-full w-64 shrink-0 bg-white dark:bg-card border-r border-border flex flex-col justify-between p-4 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}>
          {/* Main Navigation List (Dashboard through Help) */}
          <div className="overflow-y-auto pr-0.5 space-y-1">
            <nav className="space-y-1">
              {allNavItems.map((item, idx) => {
                const isActive = pathname === item.href || (item.href !== "/jobprovider/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.label + idx}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all relative overflow-hidden ${
                      isActive
                        ? "bg-[#E8EFFE] dark:bg-blue-900/30 text-[#1E40AF] dark:text-blue-400 font-bold border-l-4 border-blue-600 rounded-l-none shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-muted/50"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Sticky Bottom Actions Container: Post a New Job CTA + Profile Section */}
          <div className="pt-3 mt-auto shrink-0 space-y-3">
            {/* Post a New Job Button (Placed below Help and above Profile Section) */}
            <div>
              <Link
                href="/jobprovider/post-job"
                onClick={() => setSidebarOpen(false)}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Post a New Job
              </Link>
            </div>

            {/* Profile Info Section */}
            <div className="pt-3 border-t border-border/40">
              <div className="flex items-center gap-3 px-1">
                <img
                  src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                  alt={currentUser?.name || "demo"}
                  className="w-10 h-10 rounded-xl object-cover shrink-0 border border-border shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.name || "demo"}
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-400 truncate">
                    Premium Hub Member
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/60 dark:bg-muted/10">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
