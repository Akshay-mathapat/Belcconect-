"use client";

import React from "react";
import { CheckCircle2, Clock, MapPin, Wrench, ShieldCheck, AlertTriangle } from "lucide-react";
import { BookingStatus } from "@/types/provider";

interface BookingStatusStepperProps {
  status: BookingStatus;
  className?: string;
}

interface StepConfig {
  key: BookingStatus;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

const STEPS: StepConfig[] = [
  {
    key: "Requested",
    label: "Requested",
    sublabel: "Awaiting Pro",
    icon: Clock,
  },
  {
    key: "Accepted",
    label: "Accepted",
    sublabel: "Pro Confirmed",
    icon: ShieldCheck,
  },
  {
    key: "OnTheWay",
    label: "On The Way",
    sublabel: "Live Tracking",
    icon: MapPin,
  },
  {
    key: "Started",
    label: "In Progress",
    sublabel: "Work Started",
    icon: Wrench,
  },
  {
    key: "Completed",
    label: "Completed",
    sublabel: "Job Finished",
    icon: CheckCircle2,
  },
];

export default function BookingStatusStepper({ status, className = "" }: BookingStatusStepperProps) {
  const isCancelled = (status as string) === "Cancelled" || status === "Rejected";

  if (isCancelled) {
    return (
      <div className={`p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider">Booking {status}</h4>
            <p className="text-[11px] opacity-80">This service request has been {status.toLowerCase()}.</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate current active step index
  const activeStepIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div className={`rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-md space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          Live Service Status Progression
        </h3>

        <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-extrabold border border-blue-500/20">
          {STEPS[activeStepIdx]?.label || status}
        </span>
      </div>

      {/* Stepper Bar */}
      <div className="grid grid-cols-5 gap-2 pt-2">
        {STEPS.map((step, idx) => {
          const isCompleted = activeStepIdx > idx;
          const isCurrent = activeStepIdx === idx;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center text-center space-y-2 group">
              {/* Connector & Step Circle */}
              <div className="relative w-full flex items-center justify-center">
                {/* Progress bar line segment */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={`absolute left-1/2 w-full h-1 top-1/2 -translate-y-1/2 transition-all duration-500 ${
                      isCompleted ? "bg-emerald-500" : "bg-muted"
                    }`}
                  />
                )}

                {/* Step Circle Button */}
                <div
                  className={`relative z-10 w-9 h-9 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-95"
                      : isCurrent
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-4 ring-blue-600/20 scale-105"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isCurrent ? "animate-bounce" : ""}`} />
                </div>
              </div>

              {/* Step Labels */}
              <div className="space-y-0.5 max-w-[70px] sm:max-w-none">
                <span
                  className={`block text-[10px] sm:text-xs font-bold leading-tight truncate ${
                    isCurrent
                      ? "text-blue-600 dark:text-blue-400 font-extrabold"
                      : isCompleted
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
                <span className="hidden sm:block text-[9px] text-muted-foreground/70 truncate">
                  {step.sublabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
