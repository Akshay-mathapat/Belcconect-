"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, X, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useProviderStore } from "@/store/useProviderStore";

export function ProviderChecklistCard() {
  const { services, profile, schedule } = useProviderStore();
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const isDismissed = localStorage.getItem("belconnect_provider_checklist_dismissed") === "true";
      setDismissed(isDismissed);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!mounted || dismissed) return null;

  // Task condition checks
  const isServiceAdded = services && services.length > 0;
  const isAvailabilitySet = schedule && schedule.some((s) => s.isWorking);
  const isProfileComplete = Boolean(profile?.name && profile?.phone && profile?.photo);

  const tasks = [
    {
      id: "service",
      title: "Add your first service",
      description: "List the services you offer to start receiving customer requests.",
      href: "/provider/services/new",
      completed: isServiceAdded,
    },
    {
      id: "availability",
      title: "Set your availability",
      description: "Configure your working days and hours for seamless scheduling.",
      href: "/provider/availability",
      completed: isAvailabilitySet,
    },
    {
      id: "profile",
      title: "Complete your profile",
      description: "Ensure your name, phone number, and photo are up to date.",
      href: "/provider/profile",
      completed: isProfileComplete,
    },
  ];

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("belconnect_provider_checklist_dismissed", "true");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-card via-card to-blue-500/5 p-6 shadow-xl relative overflow-hidden mb-8">
      <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-base font-extrabold text-foreground tracking-tight flex items-center gap-2">
              Getting Started Checklist
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {completedCount} of {tasks.length} Completed
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete these setup steps to optimize your service partner profile and attract more customers.
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Dismiss Checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 w-full bg-muted/60 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-600 to-teal-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Task List */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
              task.completed
                ? "bg-emerald-500/5 border-emerald-500/30"
                : "bg-card border-border hover:border-blue-500/40"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  {task.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  )}
                  <span className={task.completed ? "line-through text-muted-foreground" : "text-foreground"}>
                    {task.title}
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                {task.description}
              </p>
            </div>

            {!task.completed && (
              <div className="mt-3 pl-6">
                <Link
                  href={task.href}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Set up now</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
