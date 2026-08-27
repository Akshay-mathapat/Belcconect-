"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { CustomerTour } from "./CustomerTour";
import { ProviderTour } from "./ProviderTour";

export function AppTour() {
  const { currentUser } = useAuthStore();

  if (!currentUser || currentUser.isFirstLogin === false) {
    return null;
  }

  if (currentUser.role === "provider") {
    return <ProviderTour />;
  }

  return <CustomerTour />;
}
