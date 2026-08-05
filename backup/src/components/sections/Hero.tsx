"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  MapPin, 
  Search, 
  ChevronDown, 
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
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SERVICE_CATEGORIES, BELAGAVI_AREAS } from "@/constants/site";
import { useTranslation } from "@/lib/i18n";

const iconMap: Record<string, any> = {
  Zap, Droplets, Sparkles, Bug, Wind, PaintBucket, Scissors, Hammer, GraduationCap, Monitor, PawPrint
};

export function Hero() {
  const { t } = useTranslation();
  const [selectedArea, setSelectedArea] = useState<string>("Belagavi (All Areas)");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [areaDropdownOpen, setAreaDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAreaDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/services?q=${encodeURIComponent(searchQuery)}`);
    } else {
      router.push("/services");
    }
  };

  return (
    <section className="relative overflow-hidden bg-background py-10 lg:py-16 border-b border-border/60">
      {/* Background radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(37,99,235,0.06),_transparent_50%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Headline — Direct user action prompt like OLX */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold tracking-tight text-foreground"
          >
            {t("hero.title")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-3 text-base sm:text-lg text-muted-foreground"
          >
            {t("hero.subtitle")}
          </motion.p>
        </div>

        {/* OLX-Style Search & Location Control Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="max-w-4xl mx-auto mb-12 sm:mb-16"
        >
          <form 
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row items-stretch gap-2 p-2 rounded-2xl sm:rounded-full bg-card border-2 border-primary/20 shadow-xl shadow-primary/5 hover:border-primary/40 transition-all"
          >
            {/* Location Filter Dropdown (OLX Style) */}
            <div ref={dropdownRef} className="relative min-w-[200px] flex-shrink-0">
              <button
                type="button"
                onClick={() => setAreaDropdownOpen(!areaDropdownOpen)}
                className="w-full flex items-center justify-between gap-2.5 px-4 py-3 text-left text-sm font-semibold text-foreground bg-muted/50 sm:bg-transparent rounded-xl sm:rounded-full hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="truncate">{selectedArea}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${areaDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Area Dropdown Menu */}
              {areaDropdownOpen && (
                <div className="absolute top-[calc(100%+0.5rem)] left-0 w-64 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50">
                  <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Location</p>
                  <button
                    type="button"
                    onClick={() => { setSelectedArea("Belagavi (All Areas)"); setAreaDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      selectedArea === "Belagavi (All Areas)" ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    Belagavi (All Areas)
                  </button>
                  {BELAGAVI_AREAS.map((area) => (
                    <button
                      key={area.name}
                      type="button"
                      onClick={() => { setSelectedArea(area.name); setAreaDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        selectedArea === area.name ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {area.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px bg-border my-2" />

            {/* Main Hero Input */}
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for Painter, Electrician, Plumber, Tutor..."
                className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-foreground placeholder-muted-foreground/70 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-xl sm:rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all flex-shrink-0"
            >
              <Search className="h-4 w-4" />
              <span>{t("nav.searchButton")}</span>
            </button>
          </form>
        </motion.div>

        {/* OLX-Style Category Tiles Grid — Immediate visual orientation */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-heading font-bold text-foreground">Browse Popular Categories</h2>
            <Link 
              href="/services" 
              className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
            >
              See all categories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {SERVICE_CATEGORIES.slice(0, 12).map((category, index) => {
              const IconComponent = iconMap[category.icon] || Sparkles;

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                >
                  <Link
                    href={`/services/${category.id}`}
                    className="group flex flex-col items-center justify-center p-4 rounded-2xl border border-border bg-card hover:border-primary hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-center h-full"
                  >
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <IconComponent className={`h-6 w-6 ${category.iconColor}`} />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {category.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                      Find Experts
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
