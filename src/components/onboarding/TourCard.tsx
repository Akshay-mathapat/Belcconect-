"use client";

import React, { useEffect, useState, useRef } from "react";
import { useOnboardingTour } from "./OnboardingContext";
import { ChevronRight, ChevronLeft, X, Check } from "lucide-react";

export function TourCard() {
  const {
    isOpen,
    isFinishedScreen,
    currentStepIndex,
    steps,
    currentStep,
    finishContent,
    nextStep,
    previousStep,
    requestSkip,
    completeTour,
  } = useOnboardingTour();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [placement, setPlacement] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const cardRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!isOpen || isFinishedScreen || !currentStep) return;
    const element = document.querySelector(`[data-tour="${currentStep.targetDataAttr}"]`) as HTMLElement;
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);

      const vh = window.innerHeight;
      const vw = window.innerWidth;
      
      let newPlacement: "top" | "bottom" | "left" | "right" = "bottom";
      
      if (currentStep.targetDataAttr === "sort-by") {
        newPlacement = "bottom";
      } else if (vw >= 768 && rect.left < 320 && rect.right + 340 < vw) {
        newPlacement = "right";
      } else if (rect.bottom + 150 > vh) { 
        if (rect.top - 150 > 0) newPlacement = "top";
      }
      
      if (vw < 640) {
        newPlacement = (rect.bottom + 150 > vh && rect.top > 150) ? "top" : "bottom";
      }

      setPlacement(newPlacement);
    } else {
      setTargetRect(null);
    }
  };

  useEffect(() => {
    updatePosition();

    let animationFrameId: number;
    const handleScrollOrResize = () => {
      animationFrameId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [currentStep, isOpen, isFinishedScreen]);

  if (!isOpen) return null;

  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  if (isFinishedScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
        <div className="bg-primary text-primary-foreground p-6 rounded-2xl max-w-xs shadow-[0_10px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/10 relative text-center">
           <h2 className="text-xl font-bold mb-2">{finishContent.title}</h2>
           <p className="text-sm mb-5 opacity-90">{finishContent.description}</p>
           <button onClick={completeTour} className="bg-white text-primary px-6 py-2.5 rounded-full font-bold w-full shadow-sm hover:bg-white/90 transition-all cursor-pointer">
             {finishContent.actionText}
           </button>
        </div>
      </div>
    );
  }

  if (!targetRect) return null;

  const isOnBookPage = typeof window !== "undefined" && window.location.pathname.startsWith("/book");
  const bookingStepEl = typeof document !== "undefined" ? document.querySelector('[data-booking-step]') : null;
  const bookingStep = bookingStepEl ? bookingStepEl.getAttribute('data-booking-step') : null;
  const isLocationModalOpen = typeof document !== "undefined" && (
    !!document.querySelector('[data-location-modal-open="true"]') ||
    !!document.querySelector('.leaflet-container')
  );

  if (isLocationModalOpen) return null;
  if (!currentStep || currentStep.hideStickyCard) return null;
  if (isOnBookPage && bookingStep !== "2") return null;

  let top = 0;
  let left = 0;
  const spacing = 14; 
  const tooltipWidth = 280;

  if (isOnBookPage && bookingStep === "2") {
    top = 220;
    left = Math.max(16, window.innerWidth - 340);
  } else if (currentStep.targetDataAttr === "sort-by") {
    // Position cleanly BELOW the Sort By card on the left
    top = targetRect.bottom + spacing;
    left = Math.max(16, targetRect.left);
  } else if (placement === "bottom") {
    top = targetRect.bottom + spacing;
    left = Math.max(16, targetRect.left + 32);
  } else if (placement === "top") {
    top = targetRect.top - spacing;
    left = Math.max(16, targetRect.left + 32);
  } else if (placement === "left") {
    top = targetRect.top + (targetRect.height / 2);
    left = targetRect.left - spacing;
  } else if (placement === "right") {
    top = targetRect.top + (targetRect.height / 2);
    left = targetRect.right + spacing;
  }

  // Constrain horizontally to viewport
  if (left < 16) left = 16;
  if (left + tooltipWidth > window.innerWidth - 16) {
    left = window.innerWidth - tooltipWidth - 16;
  }

  const getTransform = () => {
    if (placement === "top") return "translateY(-100%)";
    if (placement === "left") return "translate(-100%, -50%)";
    if (placement === "right") return "translateY(-50%)";
    return "none"; 
  };

  return (
    <div
      ref={cardRef}
      className="fixed z-[9999] bg-primary text-primary-foreground p-4 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.5)] ring-2 ring-white/20 transition-all duration-200 w-[280px] sm:w-[320px] pointer-events-auto"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        transform: getTransform(),
      }}
    >
      {/* Arrow Mark Pointer */}
      <div 
        className="absolute w-4 h-4 bg-primary rotate-45 border-t border-l border-white/30 z-20"
        style={{
          ...(placement === "bottom" && { top: -8, left: 36 }),
          ...(placement === "top" && { bottom: -8, left: 36, transform: "rotate(225deg)" }),
          ...(placement === "right" && { left: -8, top: "calc(50% - 8px)", transform: "rotate(315deg)" }),
          ...(placement === "left" && { right: -8, top: "calc(50% - 8px)", transform: "rotate(135deg)" }),
        }}
      />

      <button onClick={requestSkip} aria-label="Close guide" className="absolute top-2 right-2 p-1.5 text-primary-foreground/70 hover:text-white transition-colors cursor-pointer">
        <X className="w-4 h-4" />
      </button>

      <div className="relative z-10 pt-1">
        <h3 className="font-bold text-base mb-1 pr-6 leading-tight flex items-center gap-1.5">
          <span>{currentStep.title}</span>
        </h3>
        {currentStep.description && (
          <p className="text-sm opacity-90 leading-snug mb-4">{currentStep.description}</p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-white/20">
          {!isFirstStep ? (
            <button
              onClick={previousStep}
              aria-label="Previous step"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-9 h-9" /> 
          )}

          <span className="text-xs font-bold font-mono tracking-widest opacity-90">
            {currentStepIndex + 1} / {totalSteps}
          </span>

          <button
            onClick={nextStep}
            aria-label={isLastStep ? "Done" : "Next step"}
            className="w-9 h-9 rounded-full bg-white text-primary hover:bg-white/90 flex items-center justify-center transition-colors shadow-sm cursor-pointer"
          >
            {isLastStep ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
