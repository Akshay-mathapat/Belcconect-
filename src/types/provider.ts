export type BookingStatus =
  | "Requested"
  | "Accepted"
  | "OnTheWay"
  | "Started"
  | "Completed"
  | "PaymentReceived"
  | "ReviewSubmitted"
  | "Rejected";

export interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  customerPhoto: string;
  serviceName: string;
  category: string;
  date: string;
  time: string;
  address: string;
  status: BookingStatus;
  uploadedImages: string[];
  rating?: number;
  reviewComment?: string;
  createdAt?: string;
  serviceAddressId?: string;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  destinationPlaceId?: string | null;
  destinationAddress?: string | null;
  destinationLandmark?: string | null;
  destinationInstructions?: string | null;
}

export interface ServiceFAQ {
  question: string;
  answer: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  discountPercentage: number;
  durationMinutes: number;
  experienceYears: number;
  isAvailable: boolean;
  serviceArea: string;
  serviceRadiusKm: number;
  travelCharges: number;
  emergencyService: boolean;
  thumbnail: string;
  galleryImages: string[];
  faqs: ServiceFAQ[];
  terms: string;
  status: "Active" | "Inactive" | "Draft";
  bookingsCount: number;
  rating: number;
}

export interface PortfolioProject {
  id: string;
  title: string;
  category: string;
  description: string;
  beforeImage: string;
  afterImage: string;
  completedDate: string;
}

export interface Certificate {
  id: string;
  title: string;
  issuer: string;
  issuedYear: string;
  image: string;
  verified: boolean;
}

export interface CustomerReview {
  id: string;
  customerName: string;
  customerPhoto: string;
  rating: number;
  date: string;
  serviceName: string;
  comment: string;
  reply?: string;
}

export interface PaymentTransaction {
  id: string;
  bookingId: string;
  customerName: string;
  serviceName: string;
  amount: number;
  status: "Completed" | "Pending" | "Failed";
  date: string;
  type: "Booking Payout" | "Emergency Surge" | "Tip";
  invoiceUrl: string;
}

export interface ProviderNotification {
  id: string;
  type: "booking" | "payment" | "review" | "system" | "message";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
}

export interface ChatMessage {
  id: string;
  bookingId: string;
  sender: "provider" | "customer";
  text: string;
  timestamp: string;
  imageUrl?: string;
  isRead: boolean;
}

export interface ChatConversation {
  bookingId: string;
  customerName: string;
  customerPhoto: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: ChatMessage[];
}

export interface AvailabilitySchedule {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
}

export interface ProviderProfile {
  name: string;
  title: string;
  bio: string;
  photo: string;
  rating: number;
  totalReviews: number;
  experienceYears: number;
  languages: string[];
  skills: string[];
  address: string;
  city: string;
  phone: string;
  email: string;
  isVerified: boolean;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  panNumber: string;
  aadhaarNumber: string;
  kycStatus?: "Verified" | "Pending" | "Not Submitted";
  kycDocumentType?: string;
  kycDocumentNumber?: string;
  kycDocumentPhoto?: string;
}
