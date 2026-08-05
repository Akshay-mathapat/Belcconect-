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
      className="hidden md:flex md:w-[45%] lg:w-[40%] min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-7rem)] sticky top-0 bg-blue-600 dark:bg-blue-700 text-white p-6 sm:p-8 lg:p-10 flex-col justify-between overflow-hidden shrink-0 z-10 select-none box-border"
    >
      {/* Decorative Blur Spheres */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-black/15 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.1),transparent_60%)] pointer-events-none" />

      {/* Brand Logo Header */}
      <div className="relative z-10 flex items-center gap-3 shrink-0 pb-1">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white">
          <img src="/belconnect.png" alt="BelConnect" className="h-full w-full object-contain p-1 rounded-lg" />
        </div>
        <span className="text-xl sm:text-2xl font-bold tracking-tight font-heading text-white">
          {SITE_NAME || "BelConnect"}
        </span>
      </div>

      {/* Main Content & Feature Showcase Cards */}
      <div className="relative z-10 flex-1 flex flex-col justify-center min-h-0 py-2">
        <div className="mb-3">
          <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight text-white mb-1.5 leading-tight font-heading">
            Join {SITE_NAME || "BelConnect"}
          </h1>
          <p className="text-blue-100 text-xs sm:text-sm leading-relaxed max-w-lg">
            Create your account and access trusted local services, job opportunities, businesses, emergency assistance, and AI-powered recommendations — all from one platform.
          </p>
        </div>

        {/* 4 Feature Showcase Cards */}
        <div className="space-y-2 sm:space-y-2.5 max-w-lg">
          {/* Card 1 */}
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl p-2.5 sm:p-3 shadow-md border-l-4 border-l-blue-500 border-y border-r border-white/20 dark:border-zinc-800 text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white leading-snug">
                Book Trusted Services
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                Find verified electricians, plumbers, technicians, tutors, and more.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl p-2.5 sm:p-3 shadow-md border-l-4 border-l-emerald-500 border-y border-r border-white/20 dark:border-zinc-800 text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white leading-snug">
                Discover Local Jobs
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                Search opportunities posted by businesses in your city.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl p-2.5 sm:p-3 shadow-md border-l-4 border-l-purple-500 border-y border-r border-white/20 dark:border-zinc-800 text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 shrink-0">
              <Store className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white leading-snug">
                Explore Businesses
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                Find nearby restaurants, shops, startups, healthcare, and local services.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl p-2.5 sm:p-3 shadow-md border-l-4 border-l-orange-500 border-y border-r border-white/20 dark:border-zinc-800 text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400 shrink-0">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white leading-snug">
                AI Smart Assistant
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                Receive personalized recommendations and faster service discovery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Metrics Footer */}
      <div className="relative z-10 pt-4 border-t border-white/20 grid grid-cols-4 gap-2 text-white text-left shrink-0 mt-2">
        <div>
          <div className="text-base sm:text-lg xl:text-xl font-extrabold font-heading">4.9★</div>
          <div className="text-[10px] sm:text-[11px] text-blue-100">Rating</div>
        </div>
        <div>
          <div className="text-base sm:text-lg xl:text-xl font-extrabold font-heading">50K+</div>
          <div className="text-[10px] sm:text-[11px] text-blue-100">Providers</div>
        </div>
        <div>
          <div className="text-base sm:text-lg xl:text-xl font-extrabold font-heading">100+</div>
          <div className="text-[10px] sm:text-[11px] text-blue-100">Cities</div>
        </div>
        <div>
          <div className="text-base sm:text-lg xl:text-xl font-extrabold font-heading">1M+</div>
          <div className="text-[10px] sm:text-[11px] text-blue-100">Bookings</div>
        </div>
      </div>
    </aside>
  );
});
