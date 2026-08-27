"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2 } from "lucide-react";
import { useTourStore, CUSTOMER_TOUR_STEPS, PROVIDER_TOUR_STEPS, TourStep } from "@/store/useTourStore";
import { useTranslation } from "@/lib/i18n";

export function OnboardingTour() {
  const { activeTour, currentStepIndex, isOpen, nextStep, prevStep, endTour } = useTourStore();
  const { t } = useTranslation();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const isUpdatingRef = useRef(false);

  const steps: TourStep[] = activeTour === "customer" ? CUSTOMER_TOUR_STEPS : PROVIDER_TOUR_STEPS;
  const currentStep = steps[currentStepIndex];

  // Update target rect and popover positioning
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    function updateTargetPosition() {
      if (!currentStep) return;
      const el = document.querySelector(currentStep.targetId);

      if (el) {
        // Scroll into view if not visible
        const rect = el.getBoundingClientRect();
        const isInViewport =
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth);

        if (!isInViewport && !isUpdatingRef.current) {
          isUpdatingRef.current = true;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            setTargetRect(el.getBoundingClientRect());
            isUpdatingRef.current = false;
          }, 350);
        } else {
          setTargetRect(rect);
        }
      } else {
        // Center fallback if target element not found
        setTargetRect(null);
      }
    }

    updateTargetPosition();
    window.addEventListener("resize", updateTargetPosition);
    window.addEventListener("scroll", updateTargetPosition);

    return () => {
      window.removeEventListener("resize", updateTargetPosition);
      window.removeEventListener("scroll", updateTargetPosition);
    };
  }, [isOpen, currentStepIndex, currentStep]);

  // Calculate popover coordinates based on target rect
  useEffect(() => {
    if (!isOpen) return;

    if (targetRect && currentStep) {
      const padding = 12;
      const cardWidth = 340;
      const cardHeight = 180;
      let top = 0;
      let left = 0;

      const placement = currentStep.placement || "bottom";

      if (placement === "bottom") {
        top = targetRect.bottom + padding;
        left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
      } else if (placement === "top") {
        top = targetRect.top - cardHeight - padding;
        left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
      } else if (placement === "right") {
        top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
        left = targetRect.right + padding;
      } else if (placement === "left") {
        top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
        left = targetRect.left - cardWidth - padding;
      } else {
        // Center
        top = window.innerHeight / 2 - cardHeight / 2;
        left = window.innerWidth / 2 - cardWidth / 2;
      }

      // Constrain within viewport bounds
      top = Math.max(16, Math.min(window.innerHeight - cardHeight - 20, top));
      left = Math.max(16, Math.min(window.innerWidth - cardWidth - 20, left));

      setPopoverPos({ top, left });
    } else {
      // Screen center fallback
      setPopoverPos({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 170,
      });
    }
  }, [targetRect, isOpen, currentStep]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") nextStep();
      else if (e.key === "ArrowLeft") prevStep();
      else if (e.key === "Escape") endTour();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, nextStep, prevStep, endTour]);

  if (!isOpen || !currentStep) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-auto">
        {/* Dark Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/65 backdrop-blur-[2px] transition-all"
          onClick={endTour}
        />

        {/* Target Element Spotlight Highlight Box */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute rounded-xl pointer-events-none ring-4 ring-blue-500 ring-offset-4 ring-offset-background shadow-[0_0_30px_rgba(59,130,246,0.6)] z-[9999]"
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
          />
        )}

        {/* Floating Tour Popover Card */}
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute z-[10000] w-[340px] rounded-2xl border border-blue-500/30 bg-card p-5 shadow-2xl space-y-4 text-foreground"
          style={{
            top: popoverPos.top,
            left: popoverPos.left,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                {t("tour.stepOf")
                  .replace("{current}", String(currentStepIndex + 1))
                  .replace("{total}", String(steps.length))}
              </span>
            </div>

            <button
              onClick={endTour}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title={t("tour.skip")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Title & Description */}
          <div className="space-y-1.5">
            <h4 className="font-heading text-base font-bold text-foreground tracking-tight">
              {t(currentStep.titleKey)}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(currentStep.descKey)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <button
              onClick={endTour}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {t("tour.skip")}
            </button>

            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  onClick={prevStep}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>{t("tour.back")}</span>
                </button>
              )}

              <button
                onClick={nextStep}
                className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <span>{isLastStep ? t("tour.finish") : t("tour.next")}</span>
                {isLastStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
