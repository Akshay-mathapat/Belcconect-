import { TourStep } from "./types";

export const customerTourSteps: TourStep[] = [
  {
    id: "search",
    targetDataAttr: "customer-search, search-bar",
    title: "tour.customer.searchTitle",
    description: "tour.customer.searchDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: false,
  },
  {
    id: "categories",
    targetDataAttr: "browse-services",
    title: "tour.customer.categoryTitle",
    description: "tour.customer.categoryDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: false,
  },
  {
    id: "language",
    targetDataAttr: "language-switcher, mobile-menu",
    title: "tour.customer.langTitle",
    description: "tour.customer.langDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: false,
  },
  {
    id: "menu",
    targetDataAttr: "mobile-menu, my-bookings, nav-user-menu",
    title: "tour.customer.menuTitle",
    description: "tour.customer.menuDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: false,
  }
];

export const customerFinishContent = {
  title: "tour.customer.readyTitle",
  description: "tour.customer.readyDesc",
  actionText: "tour.finish",
  actionRoute: "/services"
};
