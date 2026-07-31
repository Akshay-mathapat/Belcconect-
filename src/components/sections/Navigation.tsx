"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Search, Sun, Moon, Monitor, ArrowRight, Globe, User, LogOut, LayoutDashboard, Settings } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { SITE_NAME, NAV_LINKS, SEARCH_SUGGESTIONS } from "@/constants/site";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation, LOCALES } from "@/lib/i18n";
import { ChevronRight, Zap, Droplets, Sparkles, Bug, Wind, PaintBucket, Scissors, Hammer, GraduationCap, PawPrint } from "lucide-react";
import { SERVICE_TAXONOMY, SERVICE_CATEGORIES } from "@/constants/site";
import CategoryBar from "@/components/sections/CategoryBar";
import { useAuthStore } from "@/store/useAuthStore";

const iconMap: Record<string, any> = {
  Zap, Droplets, Sparkles, Bug, Wind, PaintBucket, Scissors, Hammer, GraduationCap, Monitor, PawPrint
};

/* ═══════ Animated Search Placeholder ═══════ */
function AnimatedPlaceholder() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % SEARCH_SUGGESTIONS.length);
        setIsAnimating(false);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="pointer-events-none absolute inset-0 flex items-center pl-10 pr-4 text-muted-foreground/60 select-none overflow-hidden">
      <span className="whitespace-nowrap">Find a&nbsp;</span>
      <span className="relative inline-block overflow-hidden h-5">
        <motion.span
          key={currentIndex}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: isAnimating ? -20 : 0, opacity: isAnimating ? 0 : 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="inline-block font-medium text-muted-foreground/80"
        >
          {SEARCH_SUGGESTIONS[currentIndex]}
        </motion.span>
      </span>
    </span>
  );
}

/* ═══════ Search Dropdown Results ═══════ */
export function SearchDropdown({
  query,
  onClose,
  isOpen
}: {
  query: string;
  onClose: () => void;
  isOpen: boolean;
}) {
  const filteredServices = query.trim().length > 0
    ? SERVICE_CATEGORIES.filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase())
    )
    : [];

  const hasQuery = query.trim().length > 0;

  return (
    <AnimatePresence>
      {isOpen && hasQuery && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute top-[calc(100%+0.5rem)] left-0 right-0 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-50"
        >
          <div className="p-3">
            {filteredServices.length > 0 ? (
              <div className="space-y-0.5">
                {filteredServices.map((service) => {
                  const IconComponent = iconMap[service.icon] || Sparkles;
                  return (
                    <Link
                      key={service.id}
                      href={`/services/${service.id}`}
                      onClick={onClose}
                      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-muted/70 transition-all duration-150"
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
                        <IconComponent className={`h-5 w-5 ${service.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-[#1F5F5B] transition-colors">{service.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{service.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No services found for &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-muted-foreground mt-1">Try searching for Painter, Plumber, or Electrician</p>
                <Link
                  href="/services"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-[#1F5F5B] hover:text-[#164845] transition-colors"
                >
                  Browse all services
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { currentUser, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setSearchFocused(false);
    setSearchQuery("");
  }, [pathname]);

  // Close search on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    if (searchFocused) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [searchFocused]);

  // Close search on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  // Suppress public customer navigation inside Provider & Job Provider Dashboards
  if (pathname?.startsWith("/provider") || pathname?.startsWith("/jobprovider")) {
    return null;
  }

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled
          ? "bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 border-b border-border shadow-sm"
          : "bg-transparent"
          }`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5F5B] rounded-lg flex-shrink-0">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shadow-md group-hover:scale-105 transition-transform duration-200">
              <img src="/belconnect.png" alt="BelConnect" className="h-full w-full object-contain p-1 rounded-lg" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground hidden sm:inline">
              {SITE_NAME}
            </span>
          </Link>

          {/* ═══════ Clean Simple Search Bar ═══════ */}
          <div ref={searchRef} className="hidden lg:block flex-1 max-w-2xl relative">
            <div className={`relative flex items-center rounded-full border-2 transition-all duration-200 ${searchFocused
              ? "border-primary bg-card shadow-lg shadow-primary/10"
              : "border-border bg-muted/50 hover:border-primary/40 hover:bg-card hover:shadow-md"
              }`}>
              <Search className={`absolute left-3.5 h-4 w-4 transition-colors duration-200 ${searchFocused ? "text-primary" : "text-muted-foreground"
                }`} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className="w-full bg-transparent pl-10 pr-24 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none"
                placeholder="Search..."
                aria-label="Search"
                id="navbar-search-input"
              />
              {/* Search button */}
              <button
                onClick={() => {
                  if (searchQuery.trim()) {
                    router.push(`/services`);
                    setSearchFocused(false);
                  }
                }}
                className="absolute right-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
              >
                <Search className="h-3.5 w-3.5" />
                Search
              </button>
            </div>

            {/* Search dropdown */}
            <SearchDropdown
              query={searchQuery}
              onClose={() => { setSearchFocused(false); setSearchQuery(""); }}
              isOpen={searchFocused}
            />
          </div>

          {/* Right actions — desktop (Sign In & Get Started removed as requested) */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0 ml-auto">
            <div className="flex items-center gap-1">
              {/* Language Switcher */}
              <div className="relative">
                <button
                  onClick={() => { setLangOpen(!langOpen); setThemeOpen(false); }}
                  className="flex h-9 items-center justify-center rounded-full px-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5F5B]"
                  aria-label="Toggle language"
                  aria-expanded={langOpen}
                >
                  <span className="font-semibold">Lang</span>
                </button>
                <AnimatePresence>
                  {langOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-36 rounded-xl border border-border bg-card p-1 shadow-lg overflow-hidden"
                    >
                      {LOCALES.map((opt) => (
                        <button
                          key={opt.code}
                          onClick={() => { setLocale(opt.code); setLangOpen(false); }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5F5B] ${locale === opt.code ? "bg-[#1F5F5B]/10 text-[#1F5F5B] font-medium" : "text-foreground hover:bg-muted"
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
              <div className="relative">
                <button
                  onClick={() => { setThemeOpen(!themeOpen); setLangOpen(false); }}
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
                      className="absolute right-0 mt-2 w-36 rounded-xl border border-border bg-card p-1 shadow-lg overflow-hidden"
                    >
                      {themeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setTheme(opt.value); setThemeOpen(false); }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${theme === opt.value ? "bg-blue-600/10 text-blue-600 font-medium" : "text-foreground hover:bg-muted"
                            }`}
                        >
                          <opt.icon className="h-4 w-4" />
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Auth CTA or User Profile Avatar */}
            {currentUser ? (
              <div className="relative border-l border-border pl-3">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 p-1 rounded-full hover:bg-muted transition-colors focus:outline-none cursor-pointer"
                >
                  <img
                    src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                    alt={currentUser.name}
                    className="w-9 h-9 rounded-full object-cover border-2 border-blue-600/40 shadow-sm"
                  />
                  <span className="text-xs font-bold text-foreground hidden xl:block max-w-[110px] truncate">
                    {currentUser.name}
                  </span>
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-2xl overflow-hidden z-50 text-xs space-y-1"
                    >
                      <div className="px-3 py-2 border-b border-border/60">
                        <p className="font-bold text-foreground truncate">{currentUser.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{currentUser.email}</p>
                        <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {currentUser.role === "provider" ? "Service Provider" : currentUser.role === "job_provider" ? "Employer" : "Customer Account"}
                        </span>
                      </div>

                      <Link
                        href={currentUser.role === "provider" ? "/provider" : currentUser.role === "job_provider" ? "/jobprovider" : "/account"}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-foreground hover:bg-muted font-medium transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-blue-600" />
                        <span>
                          {currentUser.role === "provider" ? "Provider Dashboard" : currentUser.role === "job_provider" ? "Job Provider Workspace" : "My Account"}
                        </span>
                      </Link>

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
                        <span>Sign Out</span>
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
                  Sign In
                </Link>

                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-all"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: search icon + hamburger */}
          <div className="flex items-center gap-2 lg:hidden ml-auto">
            <button
              onClick={() => {
                setMobileOpen(false);
                setTimeout(() => {
                  const mobileInput = document.getElementById("mobile-search-input");
                  mobileInput?.focus();
                }, 100);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5F5B]"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5F5B]"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </motion.header> 

      {/* Category Bar — desktop only */}
      <div className="fixed inset-x-0 top-16 z-40">
        <CategoryBar />
      </div>

      {/* Spacer — accounts for navbar (h-16) + category bar (h-12) */}
      <div className="h-16 lg:h-28" aria-hidden="true" />

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-16 z-40 bg-background lg:hidden overflow-y-auto border-t border-border"
          >
            <div className="px-4 py-6 space-y-1">
              {/* Mobile search bar */}
              <div className="mb-5 relative">
                <div className="flex items-center rounded-2xl border-2 border-border bg-muted/50 focus-within:border-[#1F5F5B] focus-within:bg-card focus-within:shadow-lg transition-all">
                  <Search className="absolute left-4 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    id="mobile-search-input"
                    type="text"
                    placeholder="Find a Painter, Electrician, Tutor..."
                    className="w-full bg-transparent pl-11 pr-4 py-3.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none"
                    aria-label="Search for services"
                  />
                </div>
              </div>

              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;

                if (link.label === "Services") {
                  return (
                    <div key={link.href} className="flex flex-col">
                      <button
                        onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-base font-medium transition-colors ${isActive || mobileServicesOpen ? "bg-[#1F5F5B]/10 text-[#1F5F5B]" : "text-foreground hover:bg-muted"
                          }`}
                      >
                        {link.label}
                        <ChevronRight className={`h-5 w-5 transition-transform ${mobileServicesOpen ? "rotate-90" : ""}`} />
                      </button>

                      <AnimatePresence>
                        {mobileServicesOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 pr-2 py-2 space-y-4">
                              {SERVICE_TAXONOMY.map((section) => (
                                <div key={section.section} className="pl-4 border-l-2 border-border/50 space-y-2">
                                  <h4 className="text-sm font-semibold text-foreground/80 pt-2">{section.section}</h4>
                                  {section.items.map(group => (
                                    <div key={group.id} className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground pt-1">{group.name}</p>
                                      {group.services.map(serviceId => {
                                        const service = SERVICE_CATEGORIES.find(s => s.id === serviceId);
                                        if (!service) return null;
                                        return (
                                          <Link
                                            key={service.id}
                                            href={`/services/${service.id}`}
                                            onClick={() => setMobileOpen(false)}
                                            className="block py-1.5 pl-2 text-sm text-foreground hover:text-[#1F5F5B] transition-colors"
                                          >
                                            {service.name}
                                          </Link>
                                        )
                                      })}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block rounded-xl px-4 py-3.5 text-base font-medium transition-colors ${isActive ? "bg-[#1F5F5B]/10 text-[#1F5F5B]" : "text-foreground hover:bg-muted"
                      }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              <div className="my-6 border-t border-border pt-6 px-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Language</p>
                  <div className="flex flex-wrap gap-2">
                    {LOCALES.map((opt) => (
                      <button
                        key={opt.code}
                        onClick={() => { setLocale(opt.code); }}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${locale === opt.code
                          ? "border-blue-600 bg-blue-600/10 text-blue-600 font-medium"
                          : "border-border bg-card text-foreground hover:bg-muted"
                          }`}
                      >
                        {opt.nativeLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6 px-4 space-y-3">
                {currentUser ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border">
                      <img
                        src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                        alt={currentUser.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-blue-600/40"
                      />
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-foreground truncate">{currentUser.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                      </div>
                    </div>

                    <Link
                      href={currentUser.role === "provider" ? "/provider" : currentUser.role === "job_provider" ? "/jobprovider" : "/account"}
                      onClick={() => setMobileOpen(false)}
                      className="block w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
                    >
                      {currentUser.role === "provider" ? "Go to Provider Dashboard" : currentUser.role === "job_provider" ? "Go to Job Provider Portal" : "Go to My Account"}
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setMobileOpen(false);
                        router.push("/");
                      }}
                      className="block w-full rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 text-center text-sm font-bold text-rose-500 transition-colors hover:bg-rose-500/20 cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="block w-full rounded-xl border border-border bg-card py-3 text-center text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileOpen(false)}
                      className="block w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search overlay backdrop (desktop) */}
      <AnimatePresence>
        {searchFocused && searchQuery.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 hidden lg:block"
            onClick={() => setSearchFocused(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}