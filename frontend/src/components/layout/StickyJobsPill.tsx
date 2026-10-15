"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function StickyJobsPill() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  // Only show on public consumer pages, not inside private dashboards
  if (
    dismissed ||
    pathname?.startsWith("/provider") ||
    pathname?.startsWith("/jobprovider") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/jobs") ||
    pathname?.startsWith("/job-provider")
  ) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-6 right-6 z-40 flex items-center shadow-2xl"
      >
        <div className="flex items-center gap-2 rounded-full border border-blue-600/30 bg-card/95 p-1.5 pr-3.5 backdrop-blur-md shadow-lg shadow-blue-600/10 hover:border-blue-600/60 hover:shadow-xl transition-all group">
          <Link
            href="/jobs"
            className="flex items-center gap-2.5 focus:outline-none"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm group-hover:scale-105 transition-transform">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">Jobs & Hiring</span>
                <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[8px] font-extrabold text-white uppercase tracking-wider">
                  Belagavi
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-blue-600 transition-colors flex items-center gap-1">
                Explore openings & hire <ArrowRight className="h-2.5 w-2.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>

          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss sticky jobs badge"
            className="ml-1 text-muted-foreground/60 hover:text-foreground p-1 rounded-full transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

