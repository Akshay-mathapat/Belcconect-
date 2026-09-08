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
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const updateTargetRect = useCallback(() => {
    if (!currentStep || isFinishedScreen || !isOpen) {
      setRect(null);
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewport({ width: vw, height: vh });

    const isOnBookPage = typeof window !== "undefined" && window.location.pathname.startsWith("/book");
    if (isOnBookPage) {
      setRect(null);
      return;
    }

    const attr = currentStep.targetDataAttr;
    const element = document.querySelector(`[data-tour="${attr}"]`) as HTMLElement | null;

    if (element && element.offsetParent !== null && !isOnBookPage) {
      const clientRect = element.getBoundingClientRect();
      const padding = 8;

      setRect({
        top: Math.max(0, clientRect.top - padding),
        left: Math.max(0, clientRect.left - padding),
        width: clientRect.width + padding * 2,
        height: clientRect.height + padding * 2,
      });

    } else {
      setRect(null);
    }
  }, [currentStep, isOpen, isFinishedScreen]);

  useEffect(() => {
    updateTargetRect();
    
    let animationFrameId: number;
    const handleScrollOrResize = () => {
      animationFrameId = requestAnimationFrame(updateTargetRect);
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [updateTargetRect]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && currentStep && rect) {
      console.log("[TOUR] target-interactive=", currentStep.allowTargetInteraction ?? true, "target=", currentStep.targetDataAttr);
    }
  }, [currentStep, rect]);

  if (!isOpen) return null;

  const isInteractive = currentStep?.allowTargetInteraction ?? true;
  const regionBgClass = "bg-black/30";
  const pointerEventsClass = "pointer-events-auto";

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-none select-none" aria-hidden="true">
      {rect && viewport.width > 0 ? (
        <>
          <div
            className={`fixed ${regionBgClass} transition-all duration-150 ${pointerEventsClass}`}
            style={{ top: 0, left: 0, width: "100%", height: `${Math.max(0, rect.top)}px` }}
          />
          <div
            className={`fixed ${regionBgClass} transition-all duration-150 ${pointerEventsClass}`}
            style={{
              top: `${rect.top + rect.height}px`,
              left: 0,
              width: "100%",
              height: `${Math.max(0, viewport.height - (rect.top + rect.height))}px`,
            }}
          />
          <div
            className={`fixed ${regionBgClass} transition-all duration-150 ${pointerEventsClass}`}
            style={{ top: `${rect.top}px`, left: 0, width: `${Math.max(0, rect.left)}px`, height: `${rect.height}px` }}
          />
          <div
            className={`fixed ${regionBgClass} transition-all duration-150 ${pointerEventsClass}`}
            style={{
              top: `${rect.top}px`,
              left: `${rect.left + rect.width}px`,
              width: `${Math.max(0, viewport.width - (rect.left + rect.width))}px`,
              height: `${rect.height}px`,
            }}
          />

          {!isInteractive && (
            <div
              className="fixed bg-transparent pointer-events-auto"
              style={{ top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` }}
            />
          )}

          <svg className="fixed inset-0 w-full h-full pointer-events-none z-[9991]">
            <rect
              x={rect.left}
              y={rect.top}
              width={rect.width}
              height={rect.height}
              rx="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-primary animate-pulse drop-shadow-[0_0_12px_rgba(37,99,235,0.9)]"
            />
          </svg>
        </>
      ) : (
        <div className="fixed inset-0 bg-transparent pointer-events-none" />
      )}
    </div>
  );
}
