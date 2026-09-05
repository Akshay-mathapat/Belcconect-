"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TourStep } from "./types";
import { useOnboardingTour } from "./OnboardingContext";
import { X } from "lucide-react";

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
  const { requestSkip } = useOnboardingTour();
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [pinRect, setPinRect] = useState<TargetRect | null>(null);
  const [manualRect, setManualRect] = useState<TargetRect | null>(null);
  const [btnRects, setBtnRects] = useState<{ top: number; left: number; right: number; height: number; label?: string }[]>([]);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const updateTargetRect = useCallback(() => {
    if (!currentStep || isFinishedScreen || !isOpen) {
      setRect(null);
      setPinRect(null);
      setManualRect(null);
      setBtnRects([]);
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewport({ width: vw, height: vh });

    const isOnBookPage = typeof window !== "undefined" && window.location.pathname.startsWith("/book");
    const bookingStepEl = typeof document !== "undefined" ? document.querySelector('[data-booking-step]') : null;
    const bookingStep = bookingStepEl ? bookingStepEl.getAttribute('data-booking-step') : null;
    const isLocationModalOpen = typeof document !== "undefined" && (
      !!document.querySelector('[data-location-modal-open="true"]') ||
      !!document.querySelector('.leaflet-container')
    );

    if (isOnBookPage) {
      setRect(null);
      setPinRect(null);
      setManualRect(null);
      setBtnRects([]);
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

      if (attr === "providers-list" || currentStep.id === "book") {
        const btns = document.querySelectorAll(`[data-tour-book-button="true"]`);
        const list: { top: number; left: number; right: number; height: number; label?: string }[] = [];
        btns.forEach((btn) => {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            list.push({ top: r.top, left: r.left, right: r.right, height: r.height, label: "Book Here 👉" });
          }
        });
        setBtnRects(list);
      } else {
        setBtnRects([]);
      }
    } else {
      setRect(null);
      setBtnRects([]);
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
  const isOnBookPage = typeof window !== "undefined" && window.location.pathname.startsWith("/book");
  const bookingStepEl = typeof document !== "undefined" ? document.querySelector('[data-booking-step]') : null;
  const bookingStep = bookingStepEl ? bookingStepEl.getAttribute('data-booking-step') : null;
  const isLocationModalOpen = typeof document !== "undefined" && (
    !!document.querySelector('[data-location-modal-open="true"]') ||
    !!document.querySelector('.leaflet-container')
  );
  const showAddressTour = isOnBookPage && bookingStep === "2" && !isLocationModalOpen;

  const regionBgClass = isOnBookPage ? "bg-transparent" : "bg-black/30";
  const pointerEventsClass = isOnBookPage ? "pointer-events-none" : "pointer-events-auto";

  return (
    <div
      className="fixed inset-0 z-[9990] pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Dedicated Separate Sticky Note Card for Step 2 (Address Selection) */}
      {showAddressTour && (
        <div
          className="fixed z-[9995] bg-primary text-primary-foreground p-5 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.5)] ring-2 ring-white/20 w-[280px] sm:w-[320px] pointer-events-auto"
          style={{
            right: "24px",
            top: "220px",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm flex items-center gap-1.5 pr-4">
              <span>📍</span> Choose Address Mode
            </h3>
            <button
              onClick={requestSkip}
              aria-label="Close guide"
              className="p-1 rounded-lg text-primary-foreground/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs leading-relaxed opacity-95 font-medium">
            Choose your way of adding address accordingly — either pin your exact map location or enter text address manually.
          </p>
        </div>
      )}
      {rect && viewport.width > 0 ? (
        <>
          {/* Top Overlay Region */}
          <div
            className={`fixed ${regionBgClass} transition-all duration-150 ${pointerEventsClass}`}
            style={{
              top: 0,
              left: 0,
              width: "100%",
              height: `${Math.max(0, rect.top)}px`,
            }}
          />

          {/* Bottom Overlay Region */}
          <div
            className={`fixed ${regionBgClass} transition-all duration-150 ${pointerEventsClass}`}
            style={{
              top: `${rect.top + rect.height}px`,
              left: 0,
              width: "100%",
              height: `${Math.max(0, viewport.height - (rect.top + rect.height))}px`,
            }}
          />

          {/* Left Overlay Region */}
          <div
            className={`fixed ${regionBgClass} transition-all duration-150 ${pointerEventsClass}`}
            style={{
              top: `${rect.top}px`,
              left: 0,
              width: `${Math.max(0, rect.left)}px`,
              height: `${rect.height}px`,
            }}
          />

          {/* Right Overlay Region */}
          <div
            className={`fixed ${regionBgClass} transition-all duration-150 ${pointerEventsClass}`}
            style={{
              top: `${rect.top}px`,
              left: `${rect.left + rect.width}px`,
              width: `${Math.max(0, viewport.width - (rect.left + rect.width))}px`,
              height: `${rect.height}px`,
            }}
          />

          {/* If step explicitly DISALLOWS interaction, block target area specifically */}
          {!isInteractive && (
            <div
              className="fixed bg-transparent pointer-events-auto"
              style={{
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
              }}
            />
          )}

          {/* Glowing SVG Rings */}
          <svg className="fixed inset-0 w-full h-full pointer-events-none z-[9991]">
            {showAddressTour ? (
              <>
                {pinRect && (
                  <rect
                    x={pinRect.left}
                    y={pinRect.top}
                    width={pinRect.width}
                    height={pinRect.height}
                    rx="14"
                    ry="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-primary animate-pulse drop-shadow-[0_0_12px_rgba(37,99,235,0.9)]"
                  />
                )}
                {manualRect && (
                  <rect
                    x={manualRect.left}
                    y={manualRect.top}
                    width={manualRect.width}
                    height={manualRect.height}
                    rx="14"
                    ry="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-primary animate-pulse drop-shadow-[0_0_12px_rgba(37,99,235,0.9)]"
                  />
                )}
              </>
            ) : (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="16"
                ry="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-primary animate-pulse drop-shadow-[0_0_12px_rgba(37,99,235,0.9)]"
              />
            )}
          </svg>

          {/* Animated Arrow Badges over each Provider's Book Now button */}
          {btnRects.map((btnRect, idx) => (
            <div
              key={idx}
              className="fixed z-[9992] flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full shadow-xl border border-white/30 animate-pulse pointer-events-none whitespace-nowrap"
              style={{
                top: `${btnRect.top + btnRect.height / 2 - 14}px`,
                left: `${Math.max(16, btnRect.left - 120)}px`,
              }}
            >
              <span>{btnRect.label || "Book Here 👉"}</span>
            </div>
          ))}
        </>
      ) : (
        /* Fallback overlay when target element is not present */
        <div className="fixed inset-0 bg-transparent pointer-events-none" />
      )}
    </div>
  );
}
