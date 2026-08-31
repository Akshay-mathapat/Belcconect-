"use client";

import React, { useEffect, useRef } from "react";
import { useOnboardingTour } from "./OnboardingContext";
import { 
  Search, 
  UserRound, 
  CalendarCheck, 
  MapPin, 
  Navigation, 
  MessageCircle, 
  Wrench, 
  Plus, 
  ClipboardList, 
  CheckCircle, 
  Bike, 
  CircleCheck, 
  Volume2, 
  VolumeX, 
  ChevronRight, 
  ChevronLeft, 
  X,
  Sparkles,
  ShieldAlert
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Search,
  UserRound,
  CalendarCheck,
  MapPin,
  Navigation,
  MessageCircle,
  Wrench,
  Plus,
  ClipboardList,
  CheckCircle,
  Bike,
  CircleCheck,
  Sparkles
};

import { useTranslation } from "@/lib/i18n";

export function TourCard() {
  const { t } = useTranslation();
  const {
    isOpen,
    isFinishedScreen,
    currentStepIndex,
    steps,
    currentStep,
    finishContent,
    isVoiceActive,
    nextStep,
    previousStep,
    requestSkip,
    completeTour,
    toggleVoice
  } = useOnboardingTour();

  const cardRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: focus next button on step change
  useEffect(() => {
    if (isOpen && nextButtonRef.current) {
      nextButtonRef.current.focus();
    }
  }, [isOpen, currentStepIndex, isFinishedScreen]);

  if (!isOpen) return null;

  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;

  // Icon component resolution
  const IconComponent = currentStep ? (iconMap[currentStep.icon] || Sparkles) : Sparkles;

  // Check if current target element exists on page
  const hasTargetOnPage = currentStep
    ? Boolean(document.querySelector(`[data-tour="${currentStep.targetDataAttr}"]`))
    : false;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      aria-describedby="tour-step-desc"
      className="fixed inset-x-3 bottom-4 sm:bottom-8 sm:inset-x-auto sm:right-8 sm:left-auto sm:max-w-md z-[9995] animate-in fade-in slide-in-from-bottom-6 duration-300 pointer-events-auto"
    >
      <div className="rounded-3xl border-2 border-primary/30 bg-card p-5 sm:p-6 shadow-2xl shadow-black/40 ring-1 ring-white/10 flex flex-col gap-4">
        
        {/* Top Header Row: Role Badge, Voice Button & Close/Skip */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Quick Guide
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {isFinishedScreen ? t("tour.finish") : t("tour.stepOf", { current: currentStepIndex + 1, total: totalSteps })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Optional Browser Speech Synthesis Listen Button */}
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={isVoiceActive ? "Stop voice explanation" : "Listen to voice explanation"}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isVoiceActive
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/40 animate-pulse"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              {isVoiceActive ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-amber-500" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                  <span>Listen</span>
                </>
              )}
            </button>

            {/* Skip / Dismiss Button */}
            <button
              type="button"
              onClick={requestSkip}
              aria-label={t("tour.skip")}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isFinishedScreen ? (
          /* Final Completion View */
          <div className="py-2 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-2xl font-bold">
              🎉
            </div>
            <div>
              <h2 id="tour-step-title" className="text-xl font-heading font-extrabold text-foreground">
                {finishContent.title}
              </h2>
              <p id="tour-step-desc" className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
                {finishContent.description}
              </p>
            </div>

            <button
              ref={nextButtonRef}
              type="button"
              onClick={completeTour}
              className="mt-2 w-full min-h-[48px] rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{finishContent.actionText}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Active Step View */
          currentStep && (
            <div className="flex flex-col gap-3">
              {/* Step Headline & Icon */}
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="tour-step-title" className="text-lg font-heading font-bold text-foreground">
                    {t(currentStep.i18nTitleKey || "") !== (currentStep.i18nTitleKey || "") ? t(currentStep.i18nTitleKey!) : currentStep.title}
                  </h2>
                  <p id="tour-step-desc" className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    {t(currentStep.i18nDescKey || "") !== (currentStep.i18nDescKey || "") ? t(currentStep.i18nDescKey!) : currentStep.description}
                  </p>
                </div>
              </div>

              {/* Example Pills (if defined) */}
              {currentStep.examples && currentStep.examples.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1 pl-14">
                  {currentStep.examples.map((ex, i) => (
                    <span key={i} className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                      {ex}
                    </span>
                  ))}
                </div>
              )}

              {/* Privacy Note (if defined e.g. Start Travel) */}
              {currentStep.privacyNote && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span>{currentStep.privacyNote}</span>
                </div>
              )}

              {/* Graceful Fallback Explanation if target element is missing on current screen */}
              {!hasTargetOnPage && currentStep.fallbackExplanation && (
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-semibold block mb-0.5">ℹ️ Quick Tip:</span>
                  {currentStep.fallbackExplanation}
                </div>
              )}

              {/* Step Navigation Bar */}
              <div className="mt-2 flex items-center justify-between gap-3 pt-3 border-t border-border/60">
                {/* Visual Step Progress Dots */}
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {steps.map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentStepIndex
                          ? "w-6 bg-primary"
                          : idx < currentStepIndex
                          ? "w-2 bg-primary/40"
                          : "w-2 bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>

                {/* Back / Next Buttons */}
                <div className="flex items-center gap-2">
                  {!isFirstStep && (
                    <button
                      type="button"
                      onClick={previousStep}
                      className="min-h-[44px] min-w-[70px] px-3.5 py-2 rounded-xl border border-border bg-transparent text-foreground text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>{t("tour.back")}</span>
                    </button>
                  )}

                  <button
                    ref={nextButtonRef}
                    type="button"
                    onClick={nextStep}
                    className="min-h-[44px] min-w-[90px] px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{t("tour.next")}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        )}

      </div>
    </div>
  );
}
