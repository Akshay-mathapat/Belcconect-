import { TourStep } from "./types";

export const providerTourSteps: TourStep[] = [
  {
    id: "bookings",
    targetDataAttr: "provider-bookings",
    title: "tour.provider.bookingsTitle",
    description: "tour.provider.bookingsDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "services",
    targetDataAttr: "provider-services",
    title: "tour.provider.servicesTitle",
    description: "tour.provider.servicesDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "add-service",
    targetDataAttr: "add-service",
    title: "tour.provider.addServiceTitle",
    description: "tour.provider.addServiceDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  }
];

export const providerFinishContent = {
  title: "tour.provider.readyTitle",
  description: "tour.provider.readyDesc",
  actionText: "tour.done",
  actionRoute: "/provider/services"
};
