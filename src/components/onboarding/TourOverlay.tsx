"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TourStep } from "./types";

interface TourOverlayProps {
  currentStep: TourStep | null;
  isOpen: boolean;
  isFinishedScreen: boolean;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TourOverlay({ currentStep, isOpen, isFinishedScreen }: TourOverlayProps) {
  const [rect, setRect] = useState<TargetRect | null>(null);

  const updateTargetRect = useCallback(() => {
    if (!currentStep || isFinishedScreen || !isOpen) {
      setRect(null);
      return;
    }

    const attr = currentStep.targetDataAttr;
    const element = document.querySelector(`[data-tour="${attr}"]`) as HTMLElement | null;

    if (element && element.offsetParent !== null) {
      // Scroll smoothly into view if out of viewport
      element.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
        inline: "nearest"
      });

      const clientRect = element.getBoundingClientRect();
      const padding = 8;
      setRect({
        top: clientRect.top - padding,
        left: clientRect.left - padding,
        width: clientRect.width + padding * 2,
        height: clientRect.height + padding * 2
      });
    } else {
      setRect(null);
    }
  }, [currentStep, isOpen, isFinishedScreen]);

  useEffect(() => {
    updateTargetRect();
    const timer = setTimeout(updateTargetRect, 300); // Re-check after scroll/transition completes

    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [updateTargetRect]);

  if (!isOpen) return null;

  return (
    <div
      tabIndex={-1}
      className="fixed inset-0 z-[9990] pointer-events-auto transition-all duration-300 select-none"
      style={{ isolation: "isolate" }}
      aria-hidden="true"
    >
      {rect ? (
        /* Spotlight Cutout Overlay */
        <svg className="w-full h-full absolute inset-0 pointer-events-none">
          <defs>
            <mask id="tour-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="16"
                ry="16"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.75)"
            mask="url(#tour-spotlight-mask)"
          />
          {/* Highlight Border Glow Ring */}
          <rect
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            rx="16"
            ry="16"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            className="animate-pulse"
          />
        </svg>
      ) : (
        /* Fallback Backdrop Overlay when element is missing or on finished screen */
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300" />
      )}
    </div>
  );
}
