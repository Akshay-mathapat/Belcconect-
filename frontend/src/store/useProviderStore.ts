"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useAuthStore, getStoredAuthToken } from "./useAuthStore";
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
  deleteBooking: (id: string) => Promise<void>;
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
  rating: 0.0,
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
  { day: "Sunday", isWorking: true, startTime: "09:00", endTime: "19:00", breakStart: "13:00", breakEnd: "14:00" }
];

const initialConversations: ChatConversation[] = [
  {
    bookingId: "B-1001",
    customerName: "Akshay Mathapati",
    customerPhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    customerPhone: "+91 98765 43210",
    lastMessage: "Hi Rohan, are you available today for the fan installation?",
    lastMessageTime: "10:15 AM",
    unreadCount: 0,
    messages: [
      {
        id: "msg-1",
        bookingId: "B-1001",
        sender: "customer",
        text: "Hi Rohan, are you available today for the fan installation?",
        timestamp: "10:15 AM",
        isRead: true
      }
    ]
  }
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
      conversations: initialConversations,
      schedule: initialSchedule,

      toggleOnlineStatus: () => set((state) => ({ isOnline: !state.isOnline })),

      updateBookingStatus: async (id, status) => {
        try {
          const authUser = useAuthStore.getState().currentUser;
          const token = authUser?.token || getStoredAuthToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (authUser?.id) headers["x-user-id"] = authUser.id;
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch(`/api/bookings/${id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status })
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.booking) {
              set((state) => ({
                bookings: state.bookings.map((b) => b.id === id ? data.booking : b)
              }));
              try {
                const bc = new BroadcastChannel("cityconnect-bookings-sync");
                bc.postMessage({ type: "REFRESH_BOOKINGS" });
                bc.close();
              } catch (e) {}
              return;
            }
          }
          const errBody = await res.json().catch(() => ({ error: "Failed to update status on server" }));
          throw new Error(errBody.error || `Server returned ${res.status}`);
        } catch (e: any) {
          console.error(`Failed to update booking status for ${id}:`, e);
          throw e;
        }
      },

      deleteBooking: async (id) => {
        try {
          const authUser = useAuthStore.getState().currentUser;
          const token = authUser?.token || getStoredAuthToken();
          const headers: Record<string, string> = {};
          if (authUser?.id) headers["x-user-id"] = authUser.id;
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch(`/api/bookings/${id}`, {
            method: "DELETE",
            headers
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({ error: "Failed to delete booking on server" }));
            throw new Error(errBody.error || `Server returned ${res.status}`);
          }

          set((state) => ({
            bookings: state.bookings.filter((b) => b.id !== id)
          }));

          try {
            const bc = new BroadcastChannel("cityconnect-bookings-sync");
            bc.postMessage({ type: "REFRESH_BOOKINGS" });
            bc.close();
          } catch (e) {}
        } catch (e: any) {
          console.error(`Failed to delete booking ${id}:`, e);
          throw e;
        }
      },

      fetchProviderBookings: async () => {
        const currentUser = useAuthStore.getState().currentUser;
        if (!currentUser || currentUser.role !== "provider") {
          if (get().bookings.length > 0) {
            set({ bookings: [] });
          }
          return;
        }
        const providerId = currentUser.id;
        try {
          const token = currentUser.token || getStoredAuthToken();
          const headers: Record<string, string> = { "x-user-id": providerId };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch("/api/bookings", {
            headers,
            cache: "no-store"
          });
          if (res.ok) {
            const dbBookings = await res.json();
            if (Array.isArray(dbBookings)) {
              const current = get().bookings;
              if (JSON.stringify(current) !== JSON.stringify(dbBookings)) {
                set({ bookings: dbBookings });
              }
            }
          }
        } catch (e: any) {
          console.warn("Provider bookings sync retry:", e?.message || e);
        }
      },

      fetchProviderServices: async () => {
        const currentUser = useAuthStore.getState().currentUser;
        if (!currentUser || currentUser.role !== "provider") {
          if (get().services.length > 0) {
            set({ services: [] });
          }
          return;
        }
        const providerId = currentUser.id;
        try {
          const res = await fetch(`/api/services?providerId=${providerId}`, {
            cache: "no-store"
          });
          if (res.ok) {
            const dbServices = await res.json();
            if (Array.isArray(dbServices)) {
              const current = get().services;
              if (JSON.stringify(current) !== JSON.stringify(dbServices)) {
                set({ services: dbServices });
              }
            }
          }
        } catch (e: any) {
          console.warn("Provider services sync retry:", e?.message || e);
        }
      },

      addService: async (newSrv) => {
        const providerId = useAuthStore.getState().currentUser?.id;
        if (!providerId) {
          console.error("Cannot add service: provider is not logged in.");
          return;
        }
        try {
          const res = await fetch("/api/services", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerId,
              name: newSrv.name,
              category: newSrv.category,
              subcategory: newSrv.subcategory,
              description: newSrv.description
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

      syncWithAuthUser: (user) => set((state) => {
        const isDifferentUser = !!(user.email && state.profile.email && user.email.toLowerCase() !== state.profile.email.toLowerCase());
        if (isDifferentUser) {
          return {
            profile: {
              ...initialProfile,
              name: user.name || initialProfile.name,
              email: user.email || initialProfile.email,
              phone: user.phone || initialProfile.phone,
              photo: user.avatar || initialProfile.photo
            },
            bookings: [],
            services: [],
            conversations: [],
            notifications: []
          };
        }
        return {
          profile: {
            ...state.profile,
            name: user.name || state.profile.name,
            email: user.email || state.profile.email,
            phone: user.phone || state.profile.phone,
            photo: user.avatar || state.profile.photo
          }
        };
      }),

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
