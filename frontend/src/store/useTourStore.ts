"use client";

import { create } from "zustand";

export type TourType = "customer" | "provider";

export interface TourStep {
  targetId: string;
  titleKey: string;
  descKey: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

export const CUSTOMER_TOUR_STEPS: TourStep[] = [
  {
    targetId: "#tour-search-bar",
    titleKey: "tour.customer.searchTitle",
    descKey: "tour.customer.searchDesc",
    placement: "bottom",
  },
  {
    targetId: "#tour-category-grid",
    titleKey: "tour.customer.categoryTitle",
    descKey: "tour.customer.categoryDesc",
    placement: "top",
  },
  {
    targetId: "#tour-language-switcher",
    titleKey: "tour.customer.langTitle",
    descKey: "tour.customer.langDesc",
    placement: "bottom",
  },
  {
    targetId: "#tour-user-menu",
    titleKey: "tour.customer.menuTitle",
    descKey: "tour.customer.menuDesc",
    placement: "bottom",
  },
];

export const PROVIDER_TOUR_STEPS: TourStep[] = [
  {
    targetId: "#tour-provider-dashboard",
    titleKey: "tour.provider.dashboardTitle",
    descKey: "tour.provider.dashboardDesc",
    placement: "bottom",
  },
  {
    targetId: "#tour-provider-services",
    titleKey: "tour.provider.servicesTitle",
    descKey: "tour.provider.servicesDesc",
    placement: "right",
  },
  {
    targetId: "#tour-provider-bookings",
    titleKey: "tour.provider.bookingsTitle",
    descKey: "tour.provider.bookingsDesc",
    placement: "right",
  },
  {
    targetId: "#tour-provider-kyc",
    titleKey: "tour.provider.kycTitle",
    descKey: "tour.provider.kycDesc",
    placement: "top",
  },
];

interface TourState {
  activeTour: TourType | null;
  currentStepIndex: number;
  isOpen: boolean;
  startTour: (tourType: TourType) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  hasCompletedTour: (tourType: TourType) => boolean;
}

export const useTourStore = create<TourState>((set, get) => ({
  activeTour: null,
  currentStepIndex: 0,
  isOpen: false,

  startTour: (tourType: TourType) => {
    set({
      activeTour: tourType,
      currentStepIndex: 0,
      isOpen: true,
    });
  },

  nextStep: () => {
    const { activeTour, currentStepIndex } = get();
    if (!activeTour) return;

    const steps = activeTour === "customer" ? CUSTOMER_TOUR_STEPS : PROVIDER_TOUR_STEPS;
    if (currentStepIndex < steps.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1 });
    } else {
      get().endTour();
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  endTour: () => {
    const { activeTour } = get();
    if (activeTour && typeof window !== "undefined") {
      try {
        localStorage.setItem(`belconnect_tour_${activeTour}_completed`, "true");
      } catch (e) {
        console.error("Failed to save tour completion to localStorage", e);
      }
    }
    set({
      isOpen: false,
      activeTour: null,
      currentStepIndex: 0,
    });
  },

  hasCompletedTour: (tourType: TourType) => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(`belconnect_tour_${tourType}_completed`) === "true";
    } catch {
      return false;
    }
  },
}));
