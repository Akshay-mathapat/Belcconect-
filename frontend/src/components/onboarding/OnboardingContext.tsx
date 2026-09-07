"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { TourRole, TourStep } from "./types";
import { customerTourSteps, customerFinishContent } from "./customerTourSteps";
import { providerTourSteps, providerFinishContent } from "./providerTourSteps";
import { usePathname, useRouter } from "next/navigation";

export const TOUR_VERSION = "v1";

interface OnboardingContextType {
  isOpen: boolean;
  welcomeOpen: boolean;
  skipConfirmOpen: boolean;
  isFinishedScreen: boolean;
  currentStepIndex: number;
  role: TourRole;
  steps: TourStep[];
  currentStep: TourStep | null;
  finishContent: typeof customerFinishContent;
  hasUserCompletedOrSkipped: boolean;

  startTour: (overrideRole?: TourRole) => void;
  nextStep: () => void;
  previousStep: () => void;
  requestSkip: () => void;
  confirmSkip: () => void;
  cancelSkip: () => void;
  completeTour: () => void;
  restartTour: (overrideRole?: TourRole) => void;
  replayTour: (overrideRole?: TourRole) => void;
  dismissHelpCard: () => void;
  showHelpCard: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [isFinishedScreen, setIsFinishedScreen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [role, setRole] = useState<TourRole>("customer");
  const [hasUserCompletedOrSkipped, setHasUserCompletedOrSkipped] = useState(true);
  const [showHelpCard, setShowHelpCard] = useState(false);
  const [isAuthHydrated, setIsAuthHydrated] = useState(() =>
    typeof window !== "undefined" && useAuthStore.persist?.hasHydrated?.() === true
  );

  const prevFocusRef = useRef<HTMLElement | null>(null);
  const automaticTourCheckedRef = useRef<string | null>(null);

  const getStorageKey = useCallback((r: TourRole, uid: string) => {
    return `belconnect_tour:${TOUR_VERSION}:${r}:${uid}`;
  }, []);

  const steps = role === "provider" ? providerTourSteps : customerTourSteps;
  const finishContent = role === "provider" ? providerFinishContent : customerFinishContent;
  const currentStep = isFinishedScreen ? null : steps[currentStepIndex] || null;

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => setIsAuthHydrated(true));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthHydrated || !currentUser?.id) {
      setHasUserCompletedOrSkipped(true);
      setShowHelpCard(false);
      if (!currentUser) {
        automaticTourCheckedRef.current = null;
        setWelcomeOpen(false);
        setIsOpen(false);
        setIsFinishedScreen(false);
        setCurrentStepIndex(0);
      }
      return;
    }

    const userRole: TourRole = currentUser.role === "provider" ? "provider" : "customer";
    setRole(userRole);

    const storageKey = getStorageKey(userRole, currentUser.id);
    const checkKey = `${userRole}:${currentUser.id}:${TOUR_VERSION}`;
    if (automaticTourCheckedRef.current === checkKey) return;

    const dashboardReady = userRole === "provider"
      ? pathname.startsWith("/provider")
      : pathname === "/" || pathname === "/account";
    if (!dashboardReady) return;

    automaticTourCheckedRef.current = checkKey;
    const storedStatus = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;

    const isCompleted = storedStatus === "completed" || storedStatus === "skipped";
    setHasUserCompletedOrSkipped(isCompleted);
    setShowHelpCard(!isCompleted);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tourQuery = params.get("tour");
      if (tourQuery === "customer" || tourQuery === "provider") {
        setRole(tourQuery);
        setWelcomeOpen(true);
        return;
      }
    }

    if (!isCompleted) {
      const timer = setTimeout(() => {
        prevFocusRef.current = document.activeElement as HTMLElement;
        setWelcomeOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentUser, getStorageKey, isAuthHydrated, pathname]);

  const startTour = useCallback((overrideRole?: TourRole) => {
    const activeRole = overrideRole || (currentUser?.role === "provider" ? "provider" : "customer");
    prevFocusRef.current = document.activeElement as HTMLElement;
    setRole(activeRole);
    setSkipConfirmOpen(false);
    setWelcomeOpen(false);
    setIsOpen(true);
    setIsFinishedScreen(false);
    setCurrentStepIndex(0);
  }, [currentUser]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setIsFinishedScreen(true);
    }
  }, [currentStepIndex, steps.length]);

  const previousStep = useCallback(() => {
    if (isFinishedScreen) {
      setIsFinishedScreen(false);
      setCurrentStepIndex(steps.length - 1);
    } else if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [isFinishedScreen, currentStepIndex, steps.length]);

  const saveStatus = useCallback((status: "completed" | "skipped") => {
    if (currentUser?.id) {
      const key = getStorageKey(role, currentUser.id);
      if (typeof window !== "undefined") {
        localStorage.setItem(key, status);
      }
    }
    setHasUserCompletedOrSkipped(true);
    setShowHelpCard(false);
  }, [currentUser, getStorageKey, role]);

  const requestSkip = useCallback(() => {
    setSkipConfirmOpen(false);
    setIsOpen(false);
    setWelcomeOpen(false);
    setIsFinishedScreen(false);
    saveStatus("skipped");

    if (prevFocusRef.current) {
      prevFocusRef.current.focus();
    }
  }, [saveStatus]);

  const confirmSkip = useCallback(() => {
    setSkipConfirmOpen(false);
    setIsOpen(false);
    setWelcomeOpen(false);
    setIsFinishedScreen(false);
    saveStatus("skipped");

    if (prevFocusRef.current) {
      prevFocusRef.current.focus();
    }
  }, [saveStatus]);

  const cancelSkip = useCallback(() => {
    setSkipConfirmOpen(false);
  }, []);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    setWelcomeOpen(false);
    setIsFinishedScreen(false);
    saveStatus("completed");

    if (finishContent.actionRoute) {
      router.push(finishContent.actionRoute);
    }

    if (prevFocusRef.current) {
      prevFocusRef.current.focus();
    }
  }, [saveStatus, finishContent.actionRoute, router]);

  const restartTour = useCallback((overrideRole?: TourRole) => {
    const activeRole = overrideRole || (currentUser?.role === "provider" ? "provider" : "customer");
    prevFocusRef.current = document.activeElement as HTMLElement;
    setRole(activeRole);
    setSkipConfirmOpen(false);
    setWelcomeOpen(false);
    setIsOpen(true);
    setIsFinishedScreen(false);
    setCurrentStepIndex(0);
  }, [currentUser]);

  const replayTour = restartTour;

  const dismissHelpCard = useCallback(() => {
    setShowHelpCard(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (skipConfirmOpen) {
          cancelSkip();
        } else if (isOpen) {
          requestSkip();
        } else if (welcomeOpen) {
          requestSkip();
        }
      } else if (isOpen && !skipConfirmOpen) {
        if (e.key === "ArrowRight") {
          nextStep();
        } else if (e.key === "ArrowLeft") {
          previousStep();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, welcomeOpen, skipConfirmOpen, requestSkip, cancelSkip, nextStep, previousStep]);

  return (
    <OnboardingContext.Provider
      value={{
        isOpen,
        welcomeOpen,
        skipConfirmOpen,
        isFinishedScreen,
        currentStepIndex,
        role,
        steps,
        currentStep,
        finishContent,
        hasUserCompletedOrSkipped,
        startTour,
        nextStep,
        previousStep,
        requestSkip,
        confirmSkip,
        cancelSkip,
        completeTour,
        restartTour,
        replayTour,
        dismissHelpCard,
        showHelpCard
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingTour() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    return {
      isOpen: false,
      welcomeOpen: false,
      skipConfirmOpen: false,
      isFinishedScreen: false,
      currentStepIndex: 0,
      role: "customer" as TourRole,
      steps: customerTourSteps,
      currentStep: null,
      finishContent: customerFinishContent,
      hasUserCompletedOrSkipped: true,
      startTour: () => {},
      nextStep: () => {},
      previousStep: () => {},
      requestSkip: () => {},
      confirmSkip: () => {},
      cancelSkip: () => {},
      completeTour: () => {},
      restartTour: () => {},
      replayTour: () => {},
      dismissHelpCard: () => {},
      showHelpCard: false
    };
  }
  return ctx;
}
