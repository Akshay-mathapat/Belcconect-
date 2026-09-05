import { TourStep } from "./types";

export const customerTourSteps: TourStep[] = [
  {
    id: "search",
    targetDataAttr: "customer-search",
    title: "Find a Service",
    description: "Search for plumbers, electricians, painters, and more in Belagavi.",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "categories",
    targetDataAttr: "browse-services",
    title: "Browse Categories",
    description: "Click any category below (like Electrical, Plumbing, or Cleaning) to view service providers.",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "sort-by",
    targetDataAttr: "sort-by",
    title: "Sort & Filter Providers",
    description: "Filter professionals by Recommended, Rating: High to Low, or Most Experienced.",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "book",
    targetDataAttr: "providers-list",
    title: "Choose & Book Any Provider",
    description: "Click Book Now on any provider card to schedule your service request.",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
    hideStickyCard: true,
  }
];

export const customerFinishContent = {
  title: "You're Ready!",
  description: "Find a service and make your first booking.",
  actionText: "Done",
  actionRoute: "/services"
};
