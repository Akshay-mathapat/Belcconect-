"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  Building2,
  Filter,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Layers,
  Zap,
  Droplets,
  Wind,
  Hammer,
  Paintbrush,
  Car,
  Monitor,
  FileText,
  ShoppingBag,
  Truck,
  ChevronDown,
  ChevronUp,
  X,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/store/useAuthStore";

interface JobItem {
  id: string;
  title: string;
  category: string;
  job_type: string;
  work_mode: string;
  location: string;
  salary_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_text: string | null;
  openings: number;
  experience_required: string | null;
  education_required: string | null;
  description: string;
  deadline: string | null;
  status: string;
  views_count: number;
  is_boosted: boolean;
  published_at: string | null;
  created_at: string;
  company_name: string;
  company_logo: string | null;
  company_city: string | null;
  applicants_count: number;
}

export default function JobsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentUser } = useAuthStore();

  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllLocations, setShowAllLocations] = useState(false);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const jobTypes = ["all", "Full-time", "Part-time", "Contract", "Internship"];
  const workModes = ["all", "On-site", "Remote", "Hybrid"];
  const categories = [
    { id: "all", label: "All Categories", icon: Layers },
    { id: "Electrical", label: "Electrical", icon: Zap },
    { id: "Plumbing", label: "Plumbing", icon: Droplets },
    { id: "HVAC & AC Repair", label: "HVAC & AC Repair", icon: Wind },
    { id: "Carpentry", label: "Carpentry", icon: Hammer },
    { id: "Painting", label: "Painting", icon: Paintbrush },
    { id: "Automotive", label: "Automotive", icon: Car },
    { id: "IT & Tech", label: "IT & Tech", icon: Monitor },
    { id: "Administration", label: "Administration", icon: FileText },
    { id: "Retail & Sales", label: "Retail & Sales", icon: ShoppingBag },
    { id: "Logistics", label: "Logistics", icon: Truck },
  ];

  const locations = [
    "all",
    "Belagavi",
    "Tilakwadi",
    "Udyambag",
    "Shahapur",
    "Camp",
    "Hubli",
    "Dharwad",
  ];

  const activeFilterCount =
    (selectedCategory !== "all" ? 1 : 0) +
    (selectedLocation !== "all" ? 1 : 0) +
    (selectedType !== "all" ? 1 : 0) +
    (selectedWorkMode !== "all" ? 1 : 0) +
    (debouncedQuery ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSelectedLocation("all");
    setSelectedType("all");
    setSelectedWorkMode("all");
    setSearchQuery("");
  };

  const displayedCategories = showAllCategories
    ? categories
    : categories.filter((c, idx) => idx < 6 || c.id === selectedCategory);

  const displayedLocations = showAllLocations
    ? locations
    : locations.filter((loc, idx) => idx < 5 || loc === selectedLocation);

  // 300 ms Debounce for search query input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    fetchJobs(true);
  }, [debouncedQuery, selectedType, selectedWorkMode, selectedCategory, selectedLocation]);

  const fetchJobs = async (reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.append("q", debouncedQuery);
      if (selectedType !== "all") params.append("job_type", selectedType);
      if (selectedWorkMode !== "all") params.append("work_mode", selectedWorkMode);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedLocation !== "all") params.append("location", selectedLocation);
      params.append("limit", "20");

      if (!reset && nextCursor) {
        params.append("cursor", nextCursor);
      }

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const newJobs = data.jobs || [];
        setHasMore(data.hasMore || false);
        setNextCursor(data.nextCursor || null);

        if (reset) {
          setJobs(newJobs);
        } else {
          setJobs((prev) => [...prev, ...newJobs]);
        }
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const formatSalary = (job: JobItem) => {
    if (job.salary_text) return job.salary_text;
    if (job.salary_min && job.salary_max) {
      return `₹${Number(job.salary_min).toLocaleString()} - ₹${Number(job.salary_max).toLocaleString()} / mo`;
    }
    if (job.salary_min) return `₹${Number(job.salary_min).toLocaleString()} / mo`;
    return job.salary_type || "Competitive";
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const renderFilterContent = () => (
    <div className="space-y-6">
      {/* Header with Active Badge & Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-blue-600" />
          <h3 className="font-bold text-sm text-foreground">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* 1. CATEGORIES (OLX Style) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            Categories
          </label>
          {selectedCategory !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1">
          {displayedCategories.map((c) => {
            const Icon = c.icon;
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(c.id);
                  setIsMobileFilterOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                  isSelected
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-600/20 shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`} />
                  <span className="truncate">{c.label}</span>
                </div>
                {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
        {categories.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAllCategories(!showAllCategories)}
            className="w-full pt-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>{showAllCategories ? "Show Less" : `View All Categories (+${categories.length - 6})`}</span>
            {showAllCategories ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* 2. LOCATIONS (OLX Style) */}
      <div className="space-y-2 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
            Location
          </label>
          {selectedLocation !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedLocation("all")}
              className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1">
          {displayedLocations.map((loc) => {
            const isSelected = selectedLocation === loc;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  setSelectedLocation(loc);
                  setIsMobileFilterOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                  isSelected
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-600/20 shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MapPin className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`} />
                  <span className="truncate">{loc === "all" ? "All Locations" : loc}</span>
                </div>
                {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
        {locations.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAllLocations(!showAllLocations)}
            className="w-full pt-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>{showAllLocations ? "Show Less" : `View All Locations (+${locations.length - 5})`}</span>
            {showAllLocations ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* 3. JOB TYPE (OLX Style) */}
      <div className="space-y-2 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-blue-600" />
            Job Type
          </label>
          {selectedType !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedType("all")}
              className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1">
          {jobTypes.map((type) => {
            const isSelected = selectedType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setSelectedType(type);
                  setIsMobileFilterOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                  isSelected
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-600/20 shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{type === "all" ? "All Types" : type}</span>
                {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. WORK MODE (OLX Style) */}
      <div className="space-y-2 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            Work Mode
          </label>
          {selectedWorkMode !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedWorkMode("all")}
              className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1">
          {workModes.map((mode) => {
            const isSelected = selectedWorkMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setSelectedWorkMode(mode);
                  setIsMobileFilterOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                  isSelected
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-600/20 shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{mode === "all" ? "All Modes" : mode}</span>
                {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Employer CTA Box in Sidebar */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white space-y-2 shadow-xs">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <h4 className="text-xs font-bold uppercase tracking-wider">Hiring in Belagavi?</h4>
        </div>
        <p className="text-[11px] text-blue-100 leading-relaxed">
          Connect with skilled technicians, craftsmen, and local professionals.
        </p>
        <Link
          href={currentUser?.role === "job_provider" ? "/jobprovider/post-job" : "/register"}
          className="inline-block w-full py-2 text-center text-xs font-bold rounded-lg bg-white text-blue-700 hover:bg-blue-50 transition-colors shadow-sm"
        >
          Post a Job Opening
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-muted/10 text-foreground pb-20">
      {/* Hero Search Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-blue-950 to-slate-900 text-white pt-12 pb-16 px-4 sm:px-6 lg:px-8 border-b border-blue-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-bold tracking-wide uppercase">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            BelConnect Job Portal · Belagavi & North Karnataka
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
            Find Your Next Career Opportunity in Belagavi
          </h1>
          <p className="text-sm sm:text-base text-blue-100/80 max-w-2xl mx-auto">
            Discover verified full-time, part-time, and technician roles posted by top local businesses, contractors, and workshops.
          </p>

          {/* Search Bar Container */}
          <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-2 bg-white/10 dark:bg-black/30 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl max-w-3xl mx-auto">
            <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-white dark:bg-card rounded-xl text-foreground">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search job title, skills, or company (auto-searches)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/70"
              />
            </div>

            <div className="sm:w-48 flex items-center gap-2 px-3 py-2 bg-white dark:bg-card rounded-xl text-foreground">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
              >
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc === "all" ? "All Locations" : loc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar Filters (Desktop) */}
          <aside className="hidden lg:block lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-card border border-border rounded-2xl p-5 shadow-sm space-y-6 sticky top-20">
              {renderFilterContent()}
            </div>
          </aside>

          {/* Main Job Listings Column */}
          <main className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between pb-2">
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
                Showing <span className="text-foreground font-bold">{jobs.length}</span> positions
              </p>

              {/* Mobile Filter Toggle Button */}
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(true)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-white dark:bg-card text-xs font-semibold shadow-xs hover:bg-muted cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active Filters Bar */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className="text-xs text-muted-foreground font-medium">Active:</span>
                {selectedCategory !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    Category: {categories.find((c) => c.id === selectedCategory)?.label || selectedCategory}
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("all")}
                      className="hover:text-blue-800 dark:hover:text-blue-300 ml-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedLocation !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    Location: {selectedLocation}
                    <button
                      type="button"
                      onClick={() => setSelectedLocation("all")}
                      className="hover:text-blue-800 dark:hover:text-blue-300 ml-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedType !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    Type: {selectedType}
                    <button
                      type="button"
                      onClick={() => setSelectedType("all")}
                      className="hover:text-blue-800 dark:hover:text-blue-300 ml-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedWorkMode !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    Mode: {selectedWorkMode}
                    <button
                      type="button"
                      onClick={() => setSelectedWorkMode("all")}
                      className="hover:text-blue-800 dark:hover:text-blue-300 ml-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {debouncedQuery && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    "{debouncedQuery}"
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="hover:text-blue-800 dark:hover:text-blue-300 ml-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-xl bg-muted" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-1/3 bg-muted rounded" />
                        <div className="h-3 w-1/4 bg-muted rounded" />
                      </div>
                    </div>
                    <div className="h-3 w-3/4 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                  <Briefcase className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">No matching jobs found</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                    Try adjusting your search query or clearing filters to see more local opportunities.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedType("all");
                    setSelectedWorkMode("all");
                    setSelectedCategory("all");
                    setSelectedLocation("all");
                    setSearchQuery("");
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm hover:bg-blue-700 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="group rounded-2xl border border-border bg-white dark:bg-card p-5 shadow-sm hover:shadow-md hover:border-blue-600/30 transition-all cursor-pointer relative overflow-hidden"
                  >
                    {job.is_boosted && (
                      <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-extrabold uppercase px-3 py-0.5 rounded-bl-xl tracking-wider">
                        Featured
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left Company Logo & Details */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl border border-border bg-slate-50 dark:bg-muted flex items-center justify-center font-bold text-lg text-blue-600 shrink-0 overflow-hidden shadow-sm">
                          {job.company_logo ? (
                            <img src={job.company_logo} alt={job.company_name} className="w-full h-full object-cover" />
                          ) : (
                            job.company_name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">
                              {job.company_name}
                            </span>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {job.location}
                            </span>
                          </div>

                          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-blue-600 transition-colors">
                            {job.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              {job.job_type}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                              {job.work_mode}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                              {job.category}
                            </span>
                            {job.experience_required && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                                {job.experience_required}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Salary & CTA */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-border gap-2 shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-sm sm:text-base font-extrabold text-foreground">
                            {formatSalary(job)}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 sm:justify-end">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(job.created_at)}
                          </p>
                        </div>

                        <Link
                          href={`/jobs/${job.id}`}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5"
                        >
                          View Details
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Load More Button */}
                {hasMore && (
                  <div className="pt-4 text-center">
                    <button
                      onClick={() => fetchJobs(false)}
                      disabled={loadingMore}
                      className="px-8 py-3 rounded-2xl border border-border bg-white dark:bg-card text-foreground font-bold text-xs shadow-sm hover:bg-muted transition-all inline-flex items-center gap-2"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading more jobs…
                        </>
                      ) : (
                        "Load More Jobs"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filters Slide-Over Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileFilterOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative ml-auto w-full max-w-xs sm:max-w-sm h-full bg-white dark:bg-card border-l border-border shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-sm text-foreground">Filters</h3>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4">
              {renderFilterContent()}
            </div>

            {/* Drawer Footer CTA */}
            <div className="p-4 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Show {jobs.length} Positions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
