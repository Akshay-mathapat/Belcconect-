"use client";

import React from "react";
import { useOnboardingTour } from "./OnboardingContext";
import { useTranslation, LOCALES, Locale } from "@/lib/i18n";
import { Sparkles, ArrowRight, X, Globe, Check } from "lucide-react";

export function WelcomeModal() {
  const { welcomeOpen, role, startTour, requestSkip } = useOnboardingTour();
  const { locale, setLocale, t } = useTranslation();

  if (!welcomeOpen) return null;

  const isProvider = role === "provider";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-200 pointer-events-auto select-none"
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-primary/20 bg-card p-6 shadow-[0_0_50px_rgba(0,0,0,0.6)] ring-1 ring-white/10 flex flex-col items-center text-center gap-4">
        
        {/* Dismiss Icon */}
        <button
          type="button"
          onClick={requestSkip}
          aria-label={t("tour.skip")}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Welcome Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 text-primary flex items-center justify-center text-3xl shadow-inner mt-1">
          👋
        </div>

        {/* Welcome Text */}
        <div>
          <h2 id="welcome-modal-title" className="text-xl font-heading font-extrabold text-foreground flex items-center justify-center gap-2">
            {t("tour.welcomeTitle")}
          </h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-xs mx-auto">
            {t("tour.welcomeDesc")}
          </p>
        </div>

        {/* Language Selection Selector inside Welcome Screen */}
        <div className="w-full bg-muted/30 p-3 rounded-2xl border border-border/60 space-y-2 text-left">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span>Choose your language</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {LOCALES.map((lang) => {
              const isSelected = locale === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLocale(lang.code)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer border ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span className="truncate">{lang.nativeLabel}</span>
                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => startTour(role)}
            className="w-full min-h-[48px] rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t("tour.startTour")}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={requestSkip}
            className="w-full min-h-[44px] rounded-2xl border border-transparent text-muted-foreground font-semibold text-xs hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            {t("tour.skip")}
          </button>
        </div>

      </div>
    </div>
  );
}
