"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useAuthStore } from "./useAuthStore";
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
  updateBookingStatus: (id: string, status: BookingStatus) => Promise<void>;
  fetchProviderBookings: () => Promise<void>;
  fetchProviderServices: () => Promise<void>;
  
  addService: (service: Omit<ServiceItem, "id" | "bookingsCount" | "rating">) => Promise<void>;
  updateService: (id: string, service: Partial<ServiceItem>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  toggleServiceAvailability: (id: string) => Promise<void>;
  
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
    (set, get) => ({
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

      updateBookingStatus: async (id, status) => {
        try {
          const res = await fetch(`/api/bookings/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              set((state) => ({
                bookings: state.bookings.map((b) => b.id === id ? data.booking : b)
              }));
            }
          } else {
            // Fallback local update if API fails
            set((state) => ({
              bookings: state.bookings.map((b) => b.id === id ? { ...b, status } : b)
            }));
          }
        } catch (e) {
          console.error(`Failed to update booking status for ${id}:`, e);
          set((state) => ({
            bookings: state.bookings.map((b) => b.id === id ? { ...b, status } : b)
          }));
        }
      },

      fetchProviderBookings: async () => {
        const providerId = useAuthStore.getState().currentUser?.id || "provider-1";
        try {
          const res = await fetch("/api/bookings", {
            headers: { "x-user-id": providerId }
          });
          if (res.ok) {
            const dbBookings = await res.json();
            set({ bookings: dbBookings });
          }
        } catch (e) {
          console.error("Failed to load provider bookings:", e);
        }
      },



      fetchProviderServices: async () => {
        const providerId = useAuthStore.getState().currentUser?.id || "provider-1";
        try {
          const res = await fetch(`/api/services?providerId=${providerId}`);
          if (res.ok) {
            const dbServices = await res.json();
            set({ services: dbServices });
          }
        } catch (e) {
          console.error("Failed to load provider services:", e);
        }
      },

      addService: async (newSrv) => {
        const providerId = useAuthStore.getState().currentUser?.id || "provider-1";
        try {
          const res = await fetch("/api/services", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerId,
              name: newSrv.name,
              category: newSrv.category,
              subcategory: newSrv.subcategory,
              description: newSrv.description,
              basePrice: newSrv.basePrice
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              set((state) => ({
                services: [data.service, ...state.services]
              }));
            }
          }
        } catch (e) {
          console.error("Failed to add service to PostgreSQL:", e);
        }
      },

      updateService: async (id, updatedFields) => {
        try {
          const res = await fetch(`/api/services/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedFields)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              set((state) => ({
                services: state.services.map((s) => s.id === id ? data.service : s)
              }));
            }
          }
        } catch (e) {
          console.error("Failed to update service in PostgreSQL:", e);
        }
      },

      deleteService: async (id) => {
        try {
          const res = await fetch(`/api/services/${id}`, {
            method: "DELETE"
          });
          if (res.ok) {
            set((state) => ({
              services: state.services.filter((s) => s.id !== id)
            }));
          }
        } catch (e) {
          console.error("Failed to delete service in PostgreSQL:", e);
        }
      },

      toggleServiceAvailability: async (id) => {
        const srv = get().services.find((s) => s.id === id);
        if (!srv) return;
        try {
          const res = await fetch(`/api/services/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isAvailable: !srv.isAvailable })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              set((state) => ({
                services: state.services.map((s) => s.id === id ? data.service : s)
              }));
            }
          }
        } catch (e) {
          console.error("Failed to toggle service availability in PostgreSQL:", e);
        }
      },

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
