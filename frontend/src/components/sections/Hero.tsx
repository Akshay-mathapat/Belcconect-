"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  ArrowRight,
  ShieldCheck,
  Tag
} from "lucide-react";
import { SERVICE_CATEGORIES, BELAGAVI_AREAS } from "@/constants/site";
import { useTranslation } from "@/lib/i18n";
import { JobPromoBanner } from "@/components/sections/JobPromoBanner";

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
    <section className="relative overflow-hidden bg-[#070B14] py-8 lg:py-14 border-b border-border/40">
      {/* Background radial glow accents */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(37,99,235,0.12),_transparent_60%)] pointer-events-none" />
      <div className="absolute top-1/4 -left-48 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 -right-48 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* ── 1. Floating Small Jobs Promo Tooltip Banner ── */}
        <JobPromoBanner />

        {/* ── 2. Main Hero Composition with Flanking Professional Images ── */}
        <div className="relative flex flex-col xl:flex-row items-center justify-between gap-8 pb-12 sm:pb-16">
          
          {/* Left Flank — Electrical & Plumbing Image Cards */}
          <div className="hidden xl:flex flex-col gap-6 w-64 shrink-0">
            {/* Electrical Technician Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="group relative rounded-2xl overflow-hidden border border-blue-500/30 bg-[#0E1526]/90 p-2 shadow-xl shadow-blue-500/5 -rotate-2 hover:rotate-0 transition-all duration-300 hover:border-blue-400"
            >
              <div className="relative h-40 w-full rounded-xl overflow-hidden">
                <Image
                  src="/images/heroes/electrician.jpg"
                  alt="Electrical technician in Belagavi"
                  fill
                  sizes="260px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/95 text-white text-[11px] font-bold shadow-md border border-blue-400/40">
                  <Zap className="w-3 h-3 fill-current" />
                  <span>Electrical</span>
                </div>
              </div>
              <div className="px-2 pt-2 pb-1 text-left">
                <p className="text-xs font-bold text-white">Certified Technicians</p>
                <p className="text-[10px] text-slate-400 font-medium">Wiring, MCB & appliance fixes</p>
              </div>
            </motion.div>

            {/* Plumbing Professional Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="group relative rounded-2xl overflow-hidden border border-blue-500/30 bg-[#0E1526]/90 p-2 shadow-xl shadow-blue-500/5 translate-x-3 rotate-1 hover:rotate-0 transition-all duration-300 hover:border-blue-400"
            >
              <div className="relative h-40 w-full rounded-xl overflow-hidden">
                <Image
                  src="/images/heroes/plumbing.jpg"
                  alt="Plumbing professional in Belagavi"
                  fill
                  sizes="260px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-600/95 text-white text-[11px] font-bold shadow-md border border-cyan-400/40">
                  <Droplets className="w-3 h-3 fill-current" />
                  <span>Plumbing</span>
                </div>
              </div>
              <div className="px-2 pt-2 pb-1 text-left">
                <p className="text-xs font-bold text-white">Expert Plumbers</p>
                <p className="text-[10px] text-slate-400 font-medium">Leak repairs, fittings & piping</p>
              </div>
            </motion.div>
          </div>

          {/* Central Hero Column — Headline, Description, Search & Trust */}
          <div className="flex-1 max-w-3xl flex flex-col items-center text-center z-10 w-full">
            
            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-3xl sm:text-5xl lg:text-[56px] font-heading font-extrabold tracking-tight text-white leading-[1.12]"
            >
              Trusted Services,
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent">
                On Demand
              </span>{" "}
              in Belagavi.
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-4 text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed"
            >
              Book verified professionals for any service in Belagavi.
              <br className="hidden sm:inline" /> Fast, reliable, and affordable.
            </motion.p>

            {/* Main Service Search Bar Container */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="w-full max-w-2xl mt-8 sm:mt-10"
            >
              <form 
                data-tour="customer-search"
                onSubmit={handleSearch}
                className="flex flex-col sm:flex-row items-stretch gap-2 p-2 rounded-2xl sm:rounded-full bg-[#0F172A]/95 border-2 border-blue-500/30 shadow-2xl shadow-blue-600/10 hover:border-blue-500/60 transition-all backdrop-blur-md"
                suppressHydrationWarning
              >
                {/* Location Filter Dropdown */}
                <div ref={dropdownRef} className="relative min-w-[200px] flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setAreaDropdownOpen(!areaDropdownOpen)}
                    className="w-full flex items-center justify-between gap-2.5 px-4 py-3 text-left text-sm font-semibold text-white bg-slate-800/40 sm:bg-transparent rounded-xl sm:rounded-full hover:bg-slate-800/70 transition-colors"
                    suppressHydrationWarning
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <span className="truncate">{selectedArea === "Belagavi (All Areas)" ? t("common.allAreas") : selectedArea}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${areaDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Area Dropdown Menu */}
                  {areaDropdownOpen && (
                    <div className="absolute top-[calc(100%+0.5rem)] left-0 w-64 rounded-2xl border border-border bg-[#0F172A] p-2 shadow-2xl z-50">
                      <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">{t("common.selectLocation")}</p>
                      <button
                        type="button"
                        onClick={() => { setSelectedArea("Belagavi (All Areas)"); setAreaDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          selectedArea === "Belagavi (All Areas)" ? "bg-blue-600/20 text-blue-400 font-semibold" : "text-white hover:bg-slate-800"
                        }`}
                        suppressHydrationWarning
                      >
                        {t("common.allAreas")}
                      </button>
                      {BELAGAVI_AREAS.map((area) => (
                        <button
                          key={area.name}
                          type="button"
                          onClick={() => { setSelectedArea(area.name); setAreaDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                            selectedArea === area.name ? "bg-blue-600/20 text-blue-400 font-semibold" : "text-white hover:bg-slate-800"
                          }`}
                          suppressHydrationWarning
                        >
                          {area.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px bg-slate-700/60 my-2" />

                {/* Main Search Input */}
                <div className="relative flex-1 flex items-center">
                  <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for Painter, Electrician, Plumber, Tutor..."
                    className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none"
                    suppressHydrationWarning
                  />
                </div>

                {/* Submit Search Button */}
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 rounded-xl sm:rounded-full bg-blue-600 hover:bg-blue-500 px-8 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:shadow-lg transition-all flex-shrink-0"
                  suppressHydrationWarning
                >
                  <Search className="h-4 w-4" />
                  <span>Search</span>
                </button>
              </form>
            </motion.div>

            {/* ── 3. Trust and Feature Highlights ── */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-8 pt-4 w-full text-slate-300"
            >
              {/* Feature 1: Verified Professionals */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/25">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-white text-xs sm:text-sm">Verified Professionals</p>
                  <p className="text-[11px] text-slate-400 font-medium">Trusted & background checked</p>
                </div>
              </div>

              {/* Feature 2: Fast Booking */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/25">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-white text-xs sm:text-sm">Fast Booking</p>
                  <p className="text-[11px] text-slate-400 font-medium">Get service at your convenience</p>
                </div>
              </div>

              {/* Feature 3: Affordable Pricing */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/25">
                  <Tag className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-white text-xs sm:text-sm">Affordable Pricing</p>
                  <p className="text-[11px] text-slate-400 font-medium">Quality service, great value</p>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Right Flank — Cleaning & AC Repair Image Cards */}
          <div className="hidden xl:flex flex-col gap-6 w-64 shrink-0">
            {/* Cleaning Professional Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="group relative rounded-2xl overflow-hidden border border-blue-500/30 bg-[#0E1526]/90 p-2 shadow-xl shadow-blue-500/5 rotate-2 hover:rotate-0 transition-all duration-300 hover:border-blue-400"
            >
              <div className="relative h-40 w-full rounded-xl overflow-hidden">
                <Image
                  src="/images/heroes/cleaning.jpg"
                  alt="Cleaning professional in Belagavi"
                  fill
                  sizes="260px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/95 text-white text-[11px] font-bold shadow-md border border-emerald-400/40">
                  <Sparkles className="w-3 h-3 fill-current" />
                  <span>Cleaning</span>
                </div>
              </div>
              <div className="px-2 pt-2 pb-1 text-left">
                <p className="text-xs font-bold text-white">Deep Home Cleaning</p>
                <p className="text-[10px] text-slate-400 font-medium">Kitchen, bathroom & sofa care</p>
              </div>
            </motion.div>

            {/* AC Repair Professional Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="group relative rounded-2xl overflow-hidden border border-blue-500/30 bg-[#0E1526]/90 p-2 shadow-xl shadow-blue-500/5 -translate-x-3 -rotate-1 hover:rotate-0 transition-all duration-300 hover:border-blue-400"
            >
              <div className="relative h-40 w-full rounded-xl overflow-hidden">
                <Image
                  src="/images/heroes/ac-repair.jpg"
                  alt="AC Repair technician in Belagavi"
                  fill
                  sizes="260px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/95 text-white text-[11px] font-bold shadow-md border border-blue-400/40">
                  <Wind className="w-3 h-3" />
                  <span>AC Repair</span>
                </div>
              </div>
              <div className="px-2 pt-2 pb-1 text-left">
                <p className="text-xs font-bold text-white">HVAC & AC Service</p>
                <p className="text-[10px] text-slate-400 font-medium">Installation, gas refill & tuneup</p>
              </div>
            </motion.div>
          </div>

        </div>

        {/* ── 4. Browse All Categories Grid ── */}
        <div data-tour="browse-services" className="pt-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-white">Browse All Categories</h2>
            <Link 
              href="/services" 
              className="text-sm font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              View all categories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {SERVICE_CATEGORIES.slice(0, 12).map((category, index) => {
              const IconComponent = iconMap[category.icon] || Sparkles;
              const catName = t("categories." + category.id) !== ("categories." + category.id) ? t("categories." + category.id) : (t(category.i18nKey) !== category.i18nKey ? t(category.i18nKey) : category.name);

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.02 }}
                >
                  <Link
                    href={`/services/${category.id}`}
                    data-tour-category={category.id}
                    className="group flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-800 bg-[#0E1526]/80 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-600/10 transition-all duration-200 text-center h-full backdrop-blur-sm"
                  >
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <IconComponent className={`h-6 w-6 ${category.iconColor}`} />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                      {catName}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5 font-medium">
                      Verified Pros
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

export default Hero;
