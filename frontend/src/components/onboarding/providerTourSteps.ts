import { TourStep } from "./types";

export const providerTourSteps: TourStep[] = [
  {
    id: "availability",
    targetDataAttr: "provider-availability",
    title: "tour.provider.dashboardTitle",
    description: "tour.provider.dashboardDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: false,
  },
  {
    id: "services",
    targetDataAttr: "provider-services",
    title: "tour.provider.servicesTitle",
    description: "tour.provider.servicesDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: false,
  },
  {
    id: "add-service",
    targetDataAttr: "add-service",
    title: "tour.provider.servicesTitle",
    description: "tour.provider.servicesDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: false,
  },
  {
    id: "bookings",
    targetDataAttr: "provider-bookings",
    title: "tour.provider.bookingsTitle",
    description: "tour.provider.bookingsDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: false,
  },
  {
    id: "kyc",
    targetDataAttr: "provider-kyc",
    title: "tour.provider.kycTitle",
    description: "tour.provider.kycDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: false,
  }
];

export const providerFinishContent = {
  title: "tour.provider.readyTitle",
  description: "tour.provider.readyDesc",
  actionText: "tour.finish",
  actionRoute: "/provider"
};
