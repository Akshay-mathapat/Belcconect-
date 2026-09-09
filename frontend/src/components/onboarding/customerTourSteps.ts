import { TourStep } from "./types";

export const customerTourSteps: TourStep[] = [
  {
    id: "search",
    targetDataAttr: "customer-search",
    title: "tour.customer.searchTitle",
    description: "tour.customer.searchDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "categories",
    targetDataAttr: "browse-services",
    title: "tour.customer.categoryTitle",
    description: "tour.customer.categoryDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "sort-by",
    targetDataAttr: "sort-by",
    title: "tour.customer.filterTitle",
    description: "tour.customer.filterDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
  },
  {
    id: "book",
    targetDataAttr: "providers-list",
    title: "tour.customer.bookTitle",
    description: "tour.customer.bookDesc",
    allowTargetInteraction: true,
    advanceOnTargetClick: true,
    hideStickyCard: true,
  }
];

export const customerFinishContent = {
  title: "tour.customer.readyTitle",
  description: "tour.customer.readyDesc",
  actionText: "tour.done",
  actionRoute: "/services"
};
