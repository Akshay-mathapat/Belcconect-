"use client";

import Link from "next/link";
import { Briefcase, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function JobPromoBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative z-30 flex justify-center w-full px-4 mb-6 sm:mb-8"
    >
      <Link
        href="/jobs"
        className="group relative flex items-center justify-between gap-3 w-full max-w-[370px] px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#0F172A] border border-blue-500/35 shadow-lg shadow-blue-600/10 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Looking for a job in Belagavi? Explore latest openings near you."
      >
        {/* Left: Icon & Text Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0 group-hover:scale-105 transition-transform">
            <Briefcase className="h-4 w-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-white tracking-tight truncate">
              Looking for a job in Belagavi?
            </span>
            <span className="text-[11px] text-slate-300 font-medium truncate">
              Explore latest openings near you.
            </span>
          </div>
        </div>

        {/* Right: Circular Action Button */}
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shrink-0 group-hover:bg-blue-500 group-hover:scale-105 transition-all shadow-sm shadow-blue-600/40">
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>

        {/* Downward-pointing tooltip pointer triangle */}
        <div
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#141A33] border-r border-b border-blue-500/35 pointer-events-none group-hover:border-blue-400 transition-colors"
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  );
}

export default JobPromoBanner;

