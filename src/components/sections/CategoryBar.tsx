"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutGrid,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Zap,
  Droplets,
  Sparkles,
  Bug,
  Wind,
  PaintBucket,
  Scissors,
  Hammer,
  GraduationCap,
  Monitor,
  PawPrint,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SERVICE_CATEGORIES, SERVICE_TAXONOMY } from "@/constants/site";
import { useTranslation } from "@/lib/i18n";

const iconMap: Record<string, any> = {
  Zap, Droplets, Sparkles, Bug, Wind, PaintBucket, Scissors, Hammer, GraduationCap, Monitor, PawPrint
};

export default function CategoryBar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  // Suppress category bar in Provider and JobProvider dashboards
  if (pathname?.startsWith("/provider") || pathname?.startsWith("/jobprovider")) {
    return null;
  }
  const [megaOpen, setMegaOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(SERVICE_TAXONOMY[0]?.items[0]?.id || null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

  // Scroll state management
  const updateScrollState = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", updateScrollState, { passive: true });
      window.addEventListener("resize", updateScrollState);
      return () => {
        el.removeEventListener("scroll", updateScrollState);
        window.removeEventListener("resize", updateScrollState);
      };
    }
  }, []);

  // Close mega menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
        setMegaOpen(false);
      }
    };
    if (megaOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [megaOpen]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -200 : 200,
        behavior: "smooth",
      });
    }
  };

  // Popular / featured categories to show as quick pills
  const quickCategories = SERVICE_CATEGORIES;

  return (
    <div className="hidden lg:block w-full border-b border-border bg-card/80 backdrop-blur-sm relative z-40" id="tour-category-grid">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 h-12">
          
          {/* ALL CATEGORIES button */}
          <div ref={megaRef} className="relative flex-shrink-0">
            <button
              onClick={() => setMegaOpen(!megaOpen)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all duration-200 ${
                megaOpen
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:shadow-primary/25"
              }`}
              suppressHydrationWarning
            >
              <LayoutGrid className="h-4 w-4" />
              {t("nav.allCategories")}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${megaOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Mega dropdown */}
            <AnimatePresence>
              {megaOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute top-[calc(100%+0.5rem)] left-0 w-[820px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-50"
                >
                  {/* Header */}
                  <div className="px-6 pt-5 pb-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-heading font-bold text-foreground">{t("nav.browseAllCategories")}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{t("nav.findPerfectService")}</p>
                      </div>
                      <Link 
                        href="/services" 
                        onClick={() => setMegaOpen(false)}
                        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                      >
                        {t("nav.viewAll")}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  <div className="flex">
                    {/* Left Pane - Category Groups */}
                    <div className="w-[260px] bg-muted/30 border-r border-border p-4 flex flex-col gap-5">
                      {(SERVICE_TAXONOMY as unknown as any[]).map((section: any) => (
                        <div key={section.section}>
                          <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 px-3">
                            {section.section === "Home & Property" ? t("taxonomy.homeProperty") : section.section === "Lifestyle & Professional" ? t("taxonomy.lifestyle") : section.section}
                          </h4>
                          <ul className="space-y-0.5">
                            {section.items.map((group: any) => {
                              const localizedGroupName = group.name === "Home Repairs & Maintenance" ? t("taxonomy.repairs") : group.name === "Cleaning & Pest Control" ? t("taxonomy.cleaningPest") : group.name === "Renovations & Improvements" ? t("taxonomy.renovations") : group.name === "Personal Care" ? t("taxonomy.personalCare") : group.name === "Tech & Education" ? t("taxonomy.techEdu") : group.name;
                              return (
                                <li key={group.id}>
                                  <button
                                    onMouseEnter={() => setActiveGroup(group.id)}
                                    onClick={() => setActiveGroup(group.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-left ${
                                      activeGroup === group.id
                                        ? "bg-primary/10 text-primary font-semibold shadow-sm"
                                        : "text-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                    suppressHydrationWarning
                                  >
                                    <span>{localizedGroupName}</span>
                                    <ChevronRight className={`h-4 w-4 transition-all duration-150 ${activeGroup === group.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"}`} />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* Right Pane - Services Grid */}
                    <div className="flex-1 p-5">
                      <div className="grid grid-cols-2 gap-2">
                        {(SERVICE_TAXONOMY as unknown as any[]).flatMap(s => s.items).find(g => g.id === activeGroup)?.services.map((serviceId: string) => {
                          const service = SERVICE_CATEGORIES.find(s => s.id === serviceId);
                          if (!service) return null;
                          const IconComponent = iconMap[service.icon] || Sparkles;

                          const localizedName = t("categories." + service.id) !== ("categories." + service.id) ? t("categories." + service.id) : (t(service.i18nKey) !== service.i18nKey ? t(service.i18nKey) : service.name);
                          const localizedDesc = t("categoryDesc." + service.id) !== ("categoryDesc." + service.id) ? t("categoryDesc." + service.id) : service.description;

                          return (
                            <Link
                              key={service.id}
                              href={`/services/${service.id}`}
                              onClick={() => setMegaOpen(false)}
                              className="group flex items-start gap-3 p-3.5 rounded-xl hover:bg-muted/70 transition-all duration-150"
                            >
                              <div className={`mt-0.5 flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center transition-transform duration-200 group-hover:scale-110 shadow-sm`}>
                                <IconComponent className={`h-5 w-5 ${service.iconColor}`} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{localizedName}</h4>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{localizedDesc}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      {/* Helpful CTA */}
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <Link
                          href="/services"
                          onClick={() => setMegaOpen(false)}
                          className="group flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-blue-500/5 hover:from-primary/10 hover:to-blue-500/10 transition-all duration-200"
                        >
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{t("nav.findPerfectService")}</p>
                            <p className="text-xs text-muted-foreground">{t("nav.browseAllCategories")}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border flex-shrink-0" />

          {/* Scrollable category pills */}
          <div className="relative flex-1 overflow-hidden">
            {/* Left fade + arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scroll("left")}
                className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-4 bg-gradient-to-r from-card/95 via-card/80 to-transparent"
                aria-label="Scroll left"
                suppressHydrationWarning
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}

            {/* Right fade + arrow */}
            {canScrollRight && (
              <button
                onClick={() => scroll("right")}
                className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-4 bg-gradient-to-l from-card/95 via-card/80 to-transparent"
                aria-label="Scroll right"
                suppressHydrationWarning
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}

            <div
              ref={scrollRef}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {quickCategories.map((category) => {
                const IconComponent = iconMap[category.icon] || Sparkles;
                const pillName = t("categories." + category.id) !== ("categories." + category.id) ? t("categories." + category.id) : (t(category.i18nKey) !== category.i18nKey ? t(category.i18nKey) : category.name);
                return (
                  <Link
                    key={category.id}
                    href={`/services/${category.id}`}
                    data-tour-category={category.id}
                    className="group flex-shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-200 whitespace-nowrap"
                  >
                    <IconComponent className={`h-3.5 w-3.5 ${category.iconColor} opacity-70 group-hover:opacity-100 transition-opacity`} />
                    {pillName}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
