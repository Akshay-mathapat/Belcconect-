export type TourRole = "customer" | "provider";

export interface TourStep {
  id: string;
  targetDataAttr: string;
  title: string;
  description: string;
  i18nTitleKey?: string;
  i18nDescKey?: string;
  examples?: string[];
  icon?: string;
  actionText?: string;
  actionRoute?: string;
  fallbackExplanation?: string;
  privacyNote?: string;
  allowTargetInteraction?: boolean;
  advanceOnTargetClick?: boolean;
  hideStickyCard?: boolean;
}

export interface TourState {
  isOpen: boolean;
  welcomeOpen: boolean;
  skipConfirmOpen: boolean;
  currentStepIndex: number;
  role: TourRole;
  hasCompletedOrSkipped: boolean;
}
