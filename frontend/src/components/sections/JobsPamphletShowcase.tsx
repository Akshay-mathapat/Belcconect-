"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  Briefcase, 
  Building2, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Navigation as NavIcon,
  BadgeCheck,
  TrendingUp,
  MapPin
} from "lucide-react";

export function JobsPamphletShowcase() {
  return (
    <section className="relative py-14 sm:py-20 overflow-hidden bg-gradient-to-b from-background via-muted/20 to-background border-t border-border/60">
      {/* Background ambient decorative glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 translate-x-1/2 w-96 h-96 rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Tagline */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-600/10 border border-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-extrabold uppercase tracking-widest shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>BelConnect Feature Announcement</span>
          </div>

          <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-heading font-black tracking-tight text-foreground">
            Did you know? BelConnect is also Belagavi&apos;s Local Jobs Portal!
          </h2>

          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Beyond home services, we connect local job seekers with verified employers across Belagavi.
          </p>
        </div>

        {/* ── DIGITAL PAMPHLET / BROCHURE STRUCTURE ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="relative rounded-3xl border-2 border-blue-600/20 bg-card shadow-2xl shadow-blue-600/5 overflow-hidden"
        >
          {/* Top Pamphlet Ribbon Header */}
          <div className="relative bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-6 py-3 sm:py-3.5 text-white flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold tracking-wide">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>OFFICIAL BELAGAVI JOBS & HIRING NETWORK</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-blue-100 font-medium">
              <MapPin className="w-3.5 h-3.5 text-blue-300" />
              <span>Belagavi • Belgaum District</span>
            </div>
          </div>

          {/* Brochure 2-Fold Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/80">
            
            {/* ══ FOLD 1: JOB SEEKERS (FIND WORK) ══ */}
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-between hover:bg-muted/30 transition-colors">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
                  <Briefcase className="w-4 h-4" />
                  <span>For Job Seekers</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground">
                  Looking for a Job in Belagavi?
                </h3>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Browse verified vacancies in electrical, plumbing, HVAC, carpentry, cleaning, office admin, sales, and retail. Apply directly with zero commission.
                </p>

                {/* Key Benefits Checklist */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Direct chat & interview calls with local verified business owners</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>100% free application process — no registration fees or middlemen</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Real-time notifications when matching vacancies in Belagavi are posted</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Link
                  href="/jobs"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all group"
                >
                  <Search className="w-4 h-4" />
                  <span>Find Jobs in Belagavi</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <span className="text-xs text-muted-foreground text-center sm:text-right font-medium">
                  Fresh openings updated daily
                </span>
              </div>
            </div>

            {/* ══ FOLD 2: EMPLOYERS & BUSINESSES (POST A JOB) ══ */}
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-between hover:bg-muted/30 transition-colors">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-4">
                  <Building2 className="w-4 h-4" />
                  <span>For Employers & Businesses</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground">
                  Hiring Staff or Workers for your Business?
                </h3>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Post job openings in 2 minutes and connect with qualified local technicians, workers, and skilled professionals living in and around Belagavi.
                </p>

                {/* Key Benefits Checklist */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Reach thousands of active job seekers across all Belagavi areas</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Intuitive Employer Workspace to review resumes and schedule interviews</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Full candidate transparency with verified contact details</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Link
                  href="/job-provider"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all group"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Post a Job Free</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <span className="text-xs text-muted-foreground text-center sm:text-right font-medium">
                  Employer Workspace
                </span>
              </div>
            </div>

          </div>

          {/* Bottom Callout: Linking to the Nav Bar Button */}
          <div className="border-t border-border bg-blue-50/50 dark:bg-blue-950/20 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div className="flex items-center gap-2 text-xs text-foreground/80 font-medium">
              <NavIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 rotate-45" />
              <span>
                <strong>Quick Navigation Tip:</strong> You can also access Jobs anytime from the{" "}
                <span className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 bg-card px-2 py-0.5 rounded border border-border">
                  💼 Jobs NEW ▾
                </span>{" "}
                button in the sub-navigation bar above!
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Link href="/jobs" className="hover:underline">
                Explore Portal →
              </Link>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}

export default JobsPamphletShowcase;

