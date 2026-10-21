"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Star, 
  Zap, 
  Award, 
  Lock,
  BadgeCheck
} from "lucide-react";

export default function ProviderEkycSuccessPage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-center">
        {/* Celebration Shield & Animation */}
        <div className="space-y-4">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-50" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30">
              <ShieldCheck className="w-12 h-12" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-950 p-1.5 rounded-full shadow-md">
              <Sparkles className="w-4 h-4 fill-amber-950" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
              <BadgeCheck className="w-4 h-4" />
              Official Verification Complete
            </div>

            <h2 className="text-3xl font-black text-foreground tracking-tight">
              You are a Verified BelConnect Pro!
            </h2>

            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-2 leading-relaxed">
              Your government identity and facial liveness have been fully authorized by BelConnect Compliance. Your profile is now unlocked to accept customer bookings across the city.
            </p>
          </div>
        </div>

        {/* Marketplace Badge Preview Card */}
        <div className="bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-blue-500/5 border border-emerald-500/20 rounded-2xl p-5 text-left space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Marketplace Public Badge Preview
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/15 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Live on Marketplace
            </span>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-background/80 border border-border/80 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-bold text-lg">
              {currentUser?.name?.charAt(0) || "P"}
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-foreground truncate">
                  {currentUser?.name || "Professional Service Partner"}
                </h4>
                <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs shrink-0">
                  <BadgeCheck className="w-3 h-3" />
                  Verified Pro
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Government eKYC Authenticated • UIDAI & DPDP Compliant
              </p>
            </div>
          </div>
        </div>

        {/* Verified Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-foreground">3.5x Bookings</h4>
            <p className="text-[11px] text-muted-foreground">
              Verified badges build trust and attract high-value customer orders.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-foreground">Top Listing Rank</h4>
            <p className="text-[11px] text-muted-foreground">
              Your profile is prioritized in search algorithms and neighborhood matches.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Star className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-foreground">Instant Payouts</h4>
            <p className="text-[11px] text-muted-foreground">
              Direct access to same-day bank transfers and settlement privileges.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => router.push("/provider")}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <span>Enter Provider Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Your compliance credential is valid for 365 days. Thank you for partnering with BelConnect!</span>
        </div>
      </div>
    </div>
  );
}

