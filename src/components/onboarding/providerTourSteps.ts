import { TourStep } from "./types";

export const providerTourSteps: TourStep[] = [
  {
    id: "provider-services",
    targetDataAttr: "provider-services",
    title: "🛠 Add Your Service",
    description: "Tell customers what work you provide.",
    icon: "Wrench",
    fallbackExplanation: "Go to My Services to manage all your offered skills and hourly or per-job service packages."
  },
  {
    id: "add-service",
    targetDataAttr: "add-service",
    title: "➕ Add Service Details",
    description: "Add your service, price and availability.",
    icon: "Plus",
    fallbackExplanation: "Specify your service title, category, description, and price details."
  },
  {
    id: "provider-bookings",
    targetDataAttr: "provider-bookings",
    title: "📋 Receive Bookings",
    description: "New customer requests will appear here.",
    icon: "ClipboardList",
    fallbackExplanation: "All incoming customer service requests in your area will show up on your Bookings tab."
  },
  {
    id: "accept-booking",
    targetDataAttr: "accept-booking",
    title: "✅ Accept the Job",
    description: "Check the booking and accept it when you're available.",
    icon: "CheckCircle",
    fallbackExplanation: "Review job schedule, customer address, and tap Accept Booking when ready."
  },
  {
    id: "start-travel",
    targetDataAttr: "start-travel",
    title: "🛵 Start Travel",
    description: "Tap this when you leave for the customer's location.",
    icon: "Bike",
    privacyNote: "Your live location is shared only while the job is active.",
    fallbackExplanation: "Tap Start Travel when leaving. Your live location will then be safely shared with the customer."
  },
  {
    id: "start-work",
    targetDataAttr: "start-work",
    title: "🔧 Start & Complete Work",
    description: "Start the job when you arrive. Tap Complete when the work is finished.",
    icon: "CircleCheck",
    fallbackExplanation: "Tap Start Work upon arrival, and tap Mark Job Completed when work is finished."
  }
];

export const providerFinishContent = {
  title: "🎉 You're Ready!",
  description: "Add your service and start receiving bookings.",
  actionText: "Go to My Services",
  actionRoute: "/provider/services"
};
