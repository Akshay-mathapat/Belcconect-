import { TourStep } from "./types";

export const customerTourSteps: TourStep[] = [
  {
    id: "search",
    targetDataAttr: "customer-search",
    title: "🔎 Find a Service",
    description: "Choose what help you need.",
    examples: ["Electrician", "Plumber", "Cleaning", "AC Repair"],
    icon: "Search",
    fallbackExplanation: "Use the search bar or category tiles at the top to explore top-rated local experts."
  },
  {
    id: "provider",
    targetDataAttr: "provider-card",
    title: "👤 Choose a Provider",
    description: "See their service, price and rating.",
    icon: "UserRound",
    fallbackExplanation: "Compare customer ratings, experience, and transparent pricing for verified professionals."
  },
  {
    id: "book",
    targetDataAttr: "book-now",
    title: "📅 Book the Service",
    description: "Choose the service and tap Book Now.",
    icon: "CalendarCheck",
    fallbackExplanation: "Select your preferred date, time slot, and tap Book Now to reserve your service."
  },
  {
    id: "location",
    targetDataAttr: "location-picker",
    title: "📍 Confirm Your Location",
    description: "Pin where you want the service.",
    icon: "MapPin",
    fallbackExplanation: "Select your saved home address or pinpoint your exact location on the interactive map."
  },
  {
    id: "tracking",
    targetDataAttr: "booking-tracking",
    title: "🚶 Track Your Provider",
    description: "When the provider starts travelling, you can see their live location.",
    icon: "Navigation",
    privacyNote: "Live tracking starts when the provider clicks Start Travel.",
    fallbackExplanation: "Real-time movement will appear on your booking map as soon as your provider is on the way."
  },
  {
    id: "chat-call",
    targetDataAttr: "chat-call",
    title: "💬 Need Help?",
    description: "Chat or call your service provider from the booking page.",
    icon: "MessageCircle",
    fallbackExplanation: "Connect with your assigned provider via end-to-end encrypted messaging or direct voice calls."
  }
];

export const customerFinishContent = {
  title: "🎉 You're Ready!",
  description: "Choose a service and make your first booking.",
  actionText: "Find a Service",
  actionRoute: "/services"
};
