import { TourStep } from "./types";

export const providerTourSteps: TourStep[] = [
  {
    id: "bookings",
    targetDataAttr: "provider-bookings",
    title: "Manage Customer Requests",
    description: "View, accept, and manage incoming customer service requests here.",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "services",
    targetDataAttr: "provider-services",
    title: "My Offered Services",
    description: "Manage your existing service catalog, update pricing, and modify descriptions.",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "add-service",
    targetDataAttr: "add-service",
    title: "Add New Service",
    description: "Offer a new service skill to customers in Belagavi with custom rates.",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  }
];

export const providerFinishContent = {
  title: "You're Ready!",
  description: "Add your service and start receiving bookings.",
  actionText: "Done",
  actionRoute: "/provider/services"
};
