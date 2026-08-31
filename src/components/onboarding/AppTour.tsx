"use client";

import React from "react";
import { OnboardingProvider, useOnboardingTour } from "./OnboardingContext";
import { TourOverlay } from "./TourOverlay";
import { TourCard } from "./TourCard";
import { WelcomeModal } from "./WelcomeModal";
import { SkipConfirmationModal } from "./SkipConfirmationModal";

function TourContent() {
  const { currentStep, isOpen, isFinishedScreen } = useOnboardingTour();

  return (
    <>
      <WelcomeModal />
      <TourOverlay currentStep={currentStep} isOpen={isOpen} isFinishedScreen={isFinishedScreen} />
      <TourCard />
      <SkipConfirmationModal />
    </>
  );
}

export function AppTour() {
  return (
    <OnboardingProvider>
      <TourContent />
    </OnboardingProvider>
  );
}

export function CustomerTour() {
  return <AppTour />;
}

export function ProviderTour() {
  return <AppTour />;
}
