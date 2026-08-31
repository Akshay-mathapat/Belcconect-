"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { TourRole, TourStep } from "./types";
import { customerTourSteps, customerFinishContent } from "./customerTourSteps";
import { providerTourSteps, providerFinishContent } from "./providerTourSteps";
import { usePathname, useRouter } from "next/navigation";

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
  isVoiceActive: boolean;
  hasUserCompletedOrSkipped: boolean;

  startTour: (overrideRole?: TourRole) => void;
  nextStep: () => void;
  previousStep: () => void;
  requestSkip: () => void;
  confirmSkip: () => void;
  cancelSkip: () => void;
  completeTour: () => void;
  restartTour: (overrideRole?: TourRole) => void;
  toggleVoice: () => void;
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
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [hasUserCompletedOrSkipped, setHasUserCompletedOrSkipped] = useState(true);
  const [showHelpCard, setShowHelpCard] = useState(false);

  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Helper to determine storage key per user ID & role
  const getStorageKey = useCallback((r: TourRole, uid: string) => {
    return `cityconnect:onboarding:${r}:${uid}`;
  }, []);

  // Determine current steps list & finish content
  const steps = role === "provider" ? providerTourSteps : customerTourSteps;
  const finishContent = role === "provider" ? providerFinishContent : customerFinishContent;
  const currentStep = isFinishedScreen ? null : steps[currentStepIndex] || null;

  // Check tour completion status on mount / currentUser change
  useEffect(() => {
    if (!currentUser || !currentUser.id) {
      setHasUserCompletedOrSkipped(true);
      setShowHelpCard(false);
      return;
    }

    const userRole: TourRole = currentUser.role === "provider" ? "provider" : "customer";
    setRole(userRole);

    const storageKey = getStorageKey(userRole, currentUser.id);
    const storedStatus = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;

    const isCompleted = storedStatus === "completed" || storedStatus === "skipped";
    setHasUserCompletedOrSkipped(isCompleted);
    setShowHelpCard(!isCompleted);

    // Development / URL debug override: ?tour=customer or ?tour=provider
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tourQuery = params.get("tour");
      if (tourQuery === "customer" || tourQuery === "provider") {
        setRole(tourQuery);
        setWelcomeOpen(true);
        return;
      }
    }

    // Auto-trigger welcome modal ONLY for new users (isFirstLogin true or no stored key)
    if (!isCompleted && (currentUser.isFirstLogin || !storedStatus)) {
      const timer = setTimeout(() => {
        prevFocusRef.current = document.activeElement as HTMLElement;
        setWelcomeOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentUser, getStorageKey]);

  // Voice speech synthesis helper
  const speakCurrentStep = useCallback((step: TourStep | null, finished: boolean) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel(); // Stop current speech

    let textToSpeak = "";
    if (finished) {
      textToSpeak = `${finishContent.title}. ${finishContent.description}`;
    } else if (step) {
      textToSpeak = `${step.title}. ${step.description}`;
      if (step.privacyNote) {
        textToSpeak += `. Note: ${step.privacyNote}`;
      }
    }

    if (textToSpeak) {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.95; // Slightly slower for low-literacy clarity
      utterance.onend = () => setIsVoiceActive(false);
      utterance.onerror = () => setIsVoiceActive(false);
      window.speechSynthesis.speak(utterance);
      setIsVoiceActive(true);
    }
  }, [finishContent]);

  const toggleVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isVoiceActive) {
      window.speechSynthesis.cancel();
      setIsVoiceActive(false);
    } else {
      speakCurrentStep(currentStep, isFinishedScreen);
    }
  }, [isVoiceActive, currentStep, isFinishedScreen, speakCurrentStep]);

  // Stop voice on step changes unless active
  useEffect(() => {
    if (isVoiceActive) {
      speakCurrentStep(currentStep, isFinishedScreen);
    }
  }, [currentStepIndex, isFinishedScreen, isVoiceActive, currentStep, speakCurrentStep]);

  const startTour = useCallback((overrideRole?: TourRole) => {
    const activeRole = overrideRole || (currentUser?.role === "provider" ? "provider" : "customer");
    setRole(activeRole);
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

  const requestSkip = useCallback(() => {
    setSkipConfirmOpen(true);
  }, []);

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

  const confirmSkip = useCallback(() => {
    setSkipConfirmOpen(false);
    setIsOpen(false);
    setWelcomeOpen(false);
    setIsFinishedScreen(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsVoiceActive(false);
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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsVoiceActive(false);
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
    setRole(activeRole);
    setSkipConfirmOpen(false);
    setWelcomeOpen(true);
    setIsOpen(false);
    setIsFinishedScreen(false);
    setCurrentStepIndex(0);
  }, [currentUser]);

  const dismissHelpCard = useCallback(() => {
    setShowHelpCard(false);
  }, []);

  // Keyboard accessibility: Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (skipConfirmOpen) {
          cancelSkip();
        } else if (isOpen) {
          requestSkip();
        } else if (welcomeOpen) {
          setWelcomeOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, welcomeOpen, skipConfirmOpen, requestSkip, cancelSkip]);

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
        isVoiceActive,
        hasUserCompletedOrSkipped,
        startTour,
        nextStep,
        previousStep,
        requestSkip,
        confirmSkip,
        cancelSkip,
        completeTour,
        restartTour,
        toggleVoice,
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
      isVoiceActive: false,
      hasUserCompletedOrSkipped: true,
      startTour: () => {},
      nextStep: () => {},
      previousStep: () => {},
      requestSkip: () => {},
      confirmSkip: () => {},
      cancelSkip: () => {},
      completeTour: () => {},
      restartTour: () => {},
      toggleVoice: () => {},
      dismissHelpCard: () => {},
      showHelpCard: false
    };
  }
  return ctx;
}
