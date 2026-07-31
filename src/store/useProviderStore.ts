"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { 
  Booking, 
  BookingStatus, 
  ServiceItem, 
  PortfolioProject, 
  CustomerReview, 
  PaymentTransaction, 
  ProviderNotification, 
  ChatConversation, 
  AvailabilitySchedule,
  ProviderProfile 
} from "@/types/provider";

interface ProviderStoreState {
  // Provider Info
  profile: ProviderProfile;
  isOnline: boolean;
  
  // Collections (Only real data created/uploaded by user)
  bookings: Booking[];
  services: ServiceItem[];
  portfolio: PortfolioProject[];
  reviews: CustomerReview[];
  transactions: PaymentTransaction[];
  notifications: ProviderNotification[];
  conversations: ChatConversation[];
  schedule: AvailabilitySchedule[];
  
  // Actions
  toggleOnlineStatus: () => void;
  updateBookingStatus: (id: string, status: BookingStatus) => void;
  updateBookingNotes: (id: string, notes: string) => void;
  addBookingBeforeImage: (id: string, image: string) => void;
  addBookingAfterImage: (id: string, image: string) => void;
  
  addService: (service: Omit<ServiceItem, "id" | "bookingsCount" | "rating">) => void;
  updateService: (id: string, service: Partial<ServiceItem>) => void;
  deleteService: (id: string) => void;
  toggleServiceAvailability: (id: string) => void;
  
  addPortfolioProject: (project: Omit<PortfolioProject, "id">) => void;
  deletePortfolioProject: (id: string) => void;
  
  replyToReview: (id: string, replyText: string) => void;
  updateAvailabilitySchedule: (day: string, schedule: Partial<AvailabilitySchedule>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  
  sendMessage: (bookingId: string, text: string, imageUrl?: string) => void;
  updateProfile: (profile: Partial<ProviderProfile>) => void;
  syncWithAuthUser: (user: { name?: string; email?: string; phone?: string; avatar?: string }) => void;
  clearAllData: () => void;
}

const initialProfile: ProviderProfile = {
  name: "Service Provider",
  title: "Professional Service Specialist",
  bio: "Certified service professional in Belagavi. Update your bio and experience details in profile settings.",
  photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  rating: 5.0,
  totalReviews: 0,
  experienceYears: 1,
  languages: ["English", "Kannada"],
  skills: ["General Service"],
  address: "Belagavi, Karnataka",
  city: "Belagavi",
  phone: "+91 98765 43210",
  email: "provider@belconnect.in",
  isVerified: true,
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  upiId: "",
  panNumber: "",
  aadhaarNumber: ""
};

const initialSchedule: AvailabilitySchedule[] = [
  { day: "Monday", isWorking: true, startTime: "09:00", endTime: "19:00", breakStart: "13:00", breakEnd: "14:00" },
  { day: "Tuesday", isWorking: true, startTime: "09:00", endTime: "19:00", breakStart: "13:00", breakEnd: "14:00" },
  { day: "Wednesday", isWorking: true, startTime: "09:00", endTime: "19:00", breakStart: "13:00", breakEnd: "14:00" },
  { day: "Thursday", isWorking: true, startTime: "09:00", endTime: "19:00", breakStart: "13:00", breakEnd: "14:00" },
  { day: "Friday", isWorking: true, startTime: "09:00", endTime: "19:00", breakStart: "13:00", breakEnd: "14:00" },
  { day: "Saturday", isWorking: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00" },
  { day: "Sunday", isWorking: false, startTime: "10:00", endTime: "16:00", breakStart: "13:00", breakEnd: "14:00" }
];

export const useProviderStore = create<ProviderStoreState>()(
  persist(
    (set) => ({
      profile: initialProfile,
      isOnline: true,
      bookings: [],
      services: [],
      portfolio: [],
      reviews: [],
      transactions: [],
      notifications: [],
      conversations: [],
      schedule: initialSchedule,

      toggleOnlineStatus: () => set((state) => ({ isOnline: !state.isOnline })),

      updateBookingStatus: (id, status) => set((state) => ({
        bookings: state.bookings.map((b) => b.id === id ? { ...b, status } : b)
      })),

      updateBookingNotes: (id, notes) => set((state) => ({
        bookings: state.bookings.map((b) => b.id === id ? { ...b, internalNotes: notes } : b)
      })),

      addBookingBeforeImage: (id, image) => set((state) => ({
        bookings: state.bookings.map((b) => b.id === id ? { ...b, beforeImages: [...(b.beforeImages || []), image] } : b)
      })),

      addBookingAfterImage: (id, image) => set((state) => ({
        bookings: state.bookings.map((b) => b.id === id ? { ...b, afterImages: [...(b.afterImages || []), image] } : b)
      })),

      addService: (newSrv) => set((state) => {
        const created: ServiceItem = {
          ...newSrv,
          id: `SRV-${Date.now()}`,
          bookingsCount: 0,
          rating: 5.0
        };
        return { services: [created, ...state.services] };
      }),

      updateService: (id, updatedFields) => set((state) => ({
        services: state.services.map((s) => s.id === id ? { ...s, ...updatedFields } : s)
      })),

      deleteService: (id) => set((state) => ({
        services: state.services.filter((s) => s.id !== id)
      })),

      toggleServiceAvailability: (id) => set((state) => ({
        services: state.services.map((s) => s.id === id ? { ...s, isAvailable: !s.isAvailable } : s)
      })),

      addPortfolioProject: (proj) => set((state) => ({
        portfolio: [{ ...proj, id: `PORT-${Date.now()}` }, ...state.portfolio]
      })),

      deletePortfolioProject: (id) => set((state) => ({
        portfolio: state.portfolio.filter((p) => p.id !== id)
      })),

      replyToReview: (id, replyText) => set((state) => ({
        reviews: state.reviews.map((r) => r.id === id ? { ...r, reply: replyText } : r)
      })),

      updateAvailabilitySchedule: (day, updatedSchedule) => set((state) => ({
        schedule: state.schedule.map((s) => s.day === day ? { ...s, ...updatedSchedule } : s)
      })),

      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n)
      })),

      markAllNotificationsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true }))
      })),

      sendMessage: (bookingId, text, imageUrl) => set((state) => {
        const newMsg = {
          id: `m-${Date.now()}`,
          bookingId,
          sender: "provider" as const,
          text,
          timestamp: "Just now",
          imageUrl,
          isRead: true
        };
        return {
          conversations: state.conversations.map((c) => {
            if (c.bookingId === bookingId) {
              return {
                ...c,
                lastMessage: text,
                lastMessageTime: "Just now",
                messages: [...c.messages, newMsg]
              };
            }
            return c;
          })
        };
      }),

      updateProfile: (updated) => set((state) => ({
        profile: { ...state.profile, ...updated }
      })),

      syncWithAuthUser: (user) => set((state) => ({
        profile: {
          ...state.profile,
          name: user.name || state.profile.name,
          email: user.email || state.profile.email,
          phone: user.phone || state.profile.phone,
          photo: user.avatar || state.profile.photo
        }
      })),

      clearAllData: () => set(() => ({
        bookings: [],
        services: [],
        portfolio: [],
        reviews: [],
        transactions: [],
        notifications: [],
        conversations: []
      }))
    }),
    {
      name: "belconnect-provider-storage-v2",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
