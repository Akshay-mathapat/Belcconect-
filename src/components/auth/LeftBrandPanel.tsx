"use client";

import { memo } from "react";
import {
  Bot,
  Briefcase,
  Building2,
  ShieldCheck,
  Store,
} from "lucide-react";
import { SITE_NAME } from "@/constants/site";

export const LeftBrandPanel = memo(function LeftBrandPanel() {
  return (
    <aside
      className="hidden md:flex md:w-[45%] lg:w-[40%] h-full bg-blue-600 dark:bg-blue-700 text-white pt-3 px-4 pb-4 sm:pt-4 sm:px-6 sm:pb-6 lg:pt-14 lg:px-8 lg:pb-8 flex-col justify-between overflow-hidden shrink-0 z-10 select-none box-border"
    >
      {/* Decorative Blur Spheres */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-black/15 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.1),transparent_60%)] pointer-events-none" />

      {/* Main Content & Feature Showcase Cards */}
      <div className="relative z-10 flex-1 flex flex-col justify-start min-h-0 py-2">
        <div className="mb-2.5">
          <h1 className="text-xl sm:text-2xl xl:text-2xl font-extrabold tracking-tight text-white mb-1 leading-tight font-heading">
            Join {SITE_NAME || "BelConnect"}
          </h1>
          <p className="text-blue-100 text-[11px] sm:text-xs leading-relaxed max-w-lg">
            Create your account and access trusted local services, job opportunities, businesses, emergency assistance, and AI-powered recommendations — all from one platform.
          </p>
        </div>

        {/* Feature Showcase Cards */}
        <div className="space-y-1.5 max-w-lg">
          {/* Card 1 */}
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl p-2 sm:p-2.5 shadow-sm border-l-4 border-l-blue-500 border-y border-r border-white/20 dark:border-zinc-800 text-foreground flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[11px] sm:text-xs text-zinc-900 dark:text-white leading-snug">
                Book Trusted Services
              </h3>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                Find verified electricians, plumbers, technicians, tutors, and more.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl p-2 sm:p-2.5 shadow-sm border-l-4 border-l-emerald-500 border-y border-r border-white/20 dark:border-zinc-800 text-foreground flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
              <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[11px] sm:text-xs text-zinc-900 dark:text-white leading-snug">
                Discover Local Jobs
              </h3>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                Search opportunities posted by businesses in your city.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl p-2 sm:p-2.5 shadow-sm border-l-4 border-l-purple-500 border-y border-r border-white/20 dark:border-zinc-800 text-foreground flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 shrink-0">
              <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[11px] sm:text-xs text-zinc-900 dark:text-white leading-snug">
                Explore Businesses
              </h3>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                Find nearby restaurants, shops, startups, healthcare, and local services.
              </p>
            </div>
          </div>

          {/* Trust Metrics Footer */}
          <div className="relative z-10 pt-3 border-t border-white/20 grid grid-cols-4 gap-1 text-white text-left shrink-0 mt-3">
            <div>
              <div className="text-xs sm:text-sm xl:text-base font-extrabold font-heading">4.9★</div>
              <div className="text-[9px] sm:text-[10px] text-blue-100">Rating</div>
            </div>
            <div>
              <div className="text-xs sm:text-sm xl:text-base font-extrabold font-heading">50K+</div>
              <div className="text-[9px] sm:text-[10px] text-blue-100">Providers</div>
            </div>
            <div>
              <div className="text-xs sm:text-sm xl:text-base font-extrabold font-heading">100+</div>
              <div className="text-[9px] sm:text-[10px] text-blue-100">Cities</div>
            </div>
            <div>
              <div className="text-xs sm:text-sm xl:text-base font-extrabold font-heading">1M+</div>
              <div className="text-[9px] sm:text-[10px] text-blue-100">Bookings</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
});