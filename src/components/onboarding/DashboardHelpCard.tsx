"use client";

import React from "react";
import { useOnboardingTour } from "./OnboardingContext";
import { Sparkles, X } from "lucide-react";

export function DashboardHelpCard() {
  const { showHelpCard, replayTour, dismissHelpCard, role } = useOnboardingTour();

  if (!showHelpCard) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card p-4 shadow-sm relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 transition-all">
      <button
        type="button"
        onClick={dismissHelpCard}
        aria-label="Dismiss guide helper"
        className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-3 pr-6">
        <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-xl font-bold">
          👋
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            New to BelConnect?
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Learn how it works in 1 minute with our Quick Guide.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => replayTour(role)}
        className="min-h-[40px] px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5 flex-shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Show Quick Guide</span>
      </button>
    </div>
  );
}
