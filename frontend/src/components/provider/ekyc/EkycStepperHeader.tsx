"use client";

import { Check, ShieldCheck, FileText, Camera, Sparkles } from "lucide-react";

interface EkycStepperHeaderProps {
  currentStep: 1 | 2 | 3 | 4;
}

const STEPS = [
  { step: 1, title: "Identity Document", icon: FileText },
  { step: 2, title: "Upload Card", icon: ShieldCheck },
  { step: 3, title: "Live Selfie", icon: Camera },
  { step: 4, title: "Verification", icon: Sparkles },
];

export function EkycStepperHeader({ currentStep }: EkycStepperHeaderProps) {
  return (
    <div className="w-full bg-card border border-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Top Title & Compliance Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Step {currentStep} of 4
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            {STEPS[currentStep - 1]?.title || "Identity Verification"}
          </h2>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>DPDP 2023 Compliant • Masked Storage</span>
        </div>
      </div>

      {/* Visual Stepper Track */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 relative">
        {STEPS.map((s, idx) => {
          const isDone = currentStep > s.step;
          const isCurrent = currentStep === s.step;
          const Icon = s.icon;

          return (
            <div key={s.step} className="flex flex-col items-center text-center space-y-1.5">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-bold text-xs transition-all ${
                  isDone
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : isCurrent
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-4 ring-blue-600/15 scale-105"
                    : "bg-muted text-muted-foreground border border-border/70"
                }`}
              >
                {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-semibold truncate max-w-[70px] sm:max-w-none ${
                  isCurrent ? "text-foreground font-bold" : isDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                }`}
              >
                {s.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

