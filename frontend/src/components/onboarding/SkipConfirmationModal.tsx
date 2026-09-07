"use client";

import React from "react";
import { useOnboardingTour } from "./OnboardingContext";
import { HelpCircle } from "lucide-react";

export function SkipConfirmationModal() {
  const { skipConfirmOpen, confirmSkip, cancelSkip } = useOnboardingTour();

  if (!skipConfirmOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="skip-dialog-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-200 pointer-events-auto select-none"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-[0_0_50px_rgba(0,0,0,0.6)] ring-1 ring-white/10 flex flex-col items-center text-center gap-4">
        
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <HelpCircle className="w-6 h-6" />
        </div>

        <div>
          <h2 id="skip-dialog-title" className="text-lg font-heading font-bold text-foreground">
            Skip Quick Guide?
          </h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            You can open it again anytime from <span className="font-semibold text-foreground">Account → Help</span>.
          </p>
        </div>

        <div className="w-full flex items-center gap-3 mt-1">
          <button
            type="button"
            onClick={confirmSkip}
            className="flex-1 min-h-[44px] rounded-xl border border-border bg-muted/60 text-muted-foreground font-semibold text-xs hover:text-foreground hover:bg-muted transition-colors"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={cancelSkip}
            className="flex-1 min-h-[44px] rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md hover:bg-primary/90 transition-all"
          >
            Continue Guide
          </button>
        </div>

      </div>
    </div>
  );
}
