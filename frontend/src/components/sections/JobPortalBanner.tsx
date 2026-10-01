"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Briefcase, Building2, Search, PlusCircle, ArrowRight, Sparkles, Users } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function JobPortalBanner() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="max-w-7xl mx-auto mb-12 sm:mb-16"
    >
      <div className="relative overflow-hidden rounded-3xl border border-blue-600/20 bg-card p-6 sm:p-8 lg:p-10 shadow-xl shadow-blue-600/5">
        {/* Subtle accent glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Left: Heading & Value Proposition */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-3.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Jobs & Hiring Portal</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-extrabold tracking-tight text-foreground leading-tight">
              Jobs & Career Opportunities
            </h2>

            <p className="mt-2.5 text-base sm:text-lg text-foreground/90 font-medium">
              BelConnect is more than home services. Find local job opportunities or hire skilled professionals through one trusted platform.
            </p>

            <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Explore verified jobs, connect with employers, and discover skilled candidates across Belagavi and nearby regions.
            </p>
          </div>

          {/* Right: Dual Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:w-auto lg:min-w-[460px]">
            {/* Card 1: Find Jobs */}
            <Link
              href="/jobs"
              className="group flex flex-col justify-between p-5 rounded-2xl border border-border bg-muted/40 hover:bg-card hover:border-blue-600/40 hover:shadow-lg hover:shadow-blue-600/5 transition-all duration-200"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <span>FIND JOBS</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-normal">
                  Browse opportunities from local businesses and verified employers.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span>Explore Openings</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 2: Post a Job */}
            <Link
              href="/job-provider"
              className="group flex flex-col justify-between p-5 rounded-2xl border border-border bg-muted/40 hover:bg-card hover:border-blue-600/40 hover:shadow-lg hover:shadow-blue-600/5 transition-all duration-200"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <span>POST A JOB</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-normal">
                  Find and hire skilled candidates for your business.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span>Employer Workspace</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
