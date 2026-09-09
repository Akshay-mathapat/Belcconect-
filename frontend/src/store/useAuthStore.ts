"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserRole = "user" | "provider" | "job_provider";

export interface SavedAddress {
  id: string;
  type: string; // e.g. "Home", "Office", "Other"
  text: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  locationAccuracy?: number | null;
  houseNumber?: string | null;
  buildingName?: string | null;
  floor?: string | null;
  landmark?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  deliveryInstructions?: string | null;
}

export interface BookingItem {
  id: string;
  service: string;
  provider: string;
  providerId?: string;
  date: string;
  status: "Requested" | "Accepted" | "Rejected" | "OnTheWay" | "Started" | "Completed" | "Cancelled" | "Upcoming" | "ReviewSubmitted";
  rating?: number;
  reviewComment?: string;
  createdAt?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  token?: string;
  addresses?: SavedAddress[];
  bookings?: BookingItem[];
  isFirstLogin?: boolean;
  preferred_language?: string;
}

interface AuthState {
  currentUser: AuthUser | null;
  usersList: AuthUser[];

  setAuthUser: (user: AuthUser) => void;
  registerUser: (data: {
    email: string;
    password?: string;
    name: string;
    phone?: string;
    role: UserRole;
  }) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;

  loginUser: (data: {
    email: string;
    password?: string;
    role?: UserRole;
  }) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;

  updateProfile: (data: {
    name?: string;
    phone?: string;
    avatar?: string;
  }) => void;

  addAddress: (data: {
    type: string;
    text?: string;
    latitude?: number | null;
    longitude?: number | null;
    placeId?: string | null;
    locationAccuracy?: number | null;
    houseNumber?: string | null;
    buildingName?: string | null;
    floor?: string | null;
    landmark?: string | null;
    locality?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    deliveryInstructions?: string | null;
  }) => Promise<SavedAddress | undefined>;
  deleteAddress: (id: string) => Promise<void>;

  addBooking: (booking: Omit<BookingItem, "id">) => void;
  fetchUserBookings: () => Promise<void>;

  dismissTour: () => void;
  restartTour: () => void;

  logout: () => void;
}

const INITIAL_USERS: AuthUser[] = [
  {
    id: "customer-1",
    email: "customer@belconnect.com",
    name: "Akshay Mathapati",
    phone: "+91 98765 43210",
    role: "user",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    addresses: [
      { id: "addr-1", type: "Home", text: "123 Main St, Tilakwadi, Belagavi, 590006" },
      { id: "addr-2", type: "Office", text: "45 Business Park, Camp, Belagavi, 590001" }
    ],
    bookings: []
  },
  {
    id: "provider-1",
    email: "provider@belconnect.com",
    name: "Rohan Electrician",
    phone: "+91 91234 56789",
    role: "provider",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    addresses: [],
    bookings: []
  },
  {
    id: "jobprovider-1",
    email: "jobprovider@belconnect.com",
    name: "Belagavi Tech Solutions",
    phone: "+91 98888 77777",
    role: "job_provider",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80",
    addresses: [],
    bookings: []
  }
];

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      usersList: INITIAL_USERS,

      setAuthUser: (user: AuthUser) => {
        if (typeof window !== "undefined") {
          if (user.token) {
            localStorage.setItem("auth_token", user.token);
            localStorage.setItem("cityconnect_token", user.token);
            localStorage.setItem("cityconnect_auth_token", user.token);
          }
          if (user.id) {
            localStorage.setItem("cityconnect_user_id", user.id);
            localStorage.setItem("user_id", user.id);
          }
        }
        set((state) => {
          const exists = state.usersList.some((u) => u.id === user.id);
          const list = exists
            ? state.usersList.map((u) => (u.id === user.id ? user : u))
            : [...state.usersList, user];
          return { currentUser: user, usersList: list };
        });
      },

      registerUser: async ({ email, password, name, phone, role }) => {
        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              password: password || "password123",
              name,
              phone,
              role
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const user: AuthUser = { bookings: [], isFirstLogin: true, ...data.user, token: data.token };
            if (typeof window !== "undefined") {
              if (data.token) {
                localStorage.setItem("auth_token", data.token);
                localStorage.setItem("cityconnect_token", data.token);
                localStorage.setItem("cityconnect_auth_token", data.token);
              }
              if (user.id) {
                localStorage.setItem("cityconnect_user_id", user.id);
                localStorage.setItem("user_id", user.id);
              }
            }
            set((state) => ({
              usersList: [...state.usersList, user],
              currentUser: user
            }));
            return { success: true, user };
          } else {
            return { success: false, error: data.error || "Registration failed" };
          }
        } catch (e) {
          console.error("Register API error:", e);
          return { success: false, error: "Network or Server error. Please check database connection." };
        }
      },

      loginUser: async ({ email, password }) => {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              password: password || "password123"
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const user = { bookings: [], ...data.user, token: data.token };
            if (typeof window !== "undefined") {
              if (data.token) {
                localStorage.setItem("auth_token", data.token);
                localStorage.setItem("cityconnect_token", data.token);
                localStorage.setItem("cityconnect_auth_token", data.token);
              }
              if (user.id) {
                localStorage.setItem("cityconnect_user_id", user.id);
                localStorage.setItem("user_id", user.id);
              }
            }
            set((state) => {
              const list = state.usersList.map((u) => u.id === user.id ? user : u);
              return { currentUser: user, usersList: list };
            });
            return { success: true, user };
          } else {
            return { success: false, error: data.error || "Login failed" };
          }
        } catch (e) {
          console.error("Login API error:", e);
          return { success: false, error: "Network or Server error. Please check database connection." };
        }
      },

      updateProfile: ({ name, phone, avatar }) => {
        const current = get().currentUser;
        if (!current) return;

        const updatedUser: AuthUser = {
          ...current,
          name: name !== undefined ? name : current.name,
          phone: phone !== undefined ? phone : current.phone,
          avatar: avatar !== undefined ? avatar : current.avatar
        };

        // Sync profile changes to PostgreSQL
        fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: updatedUser })
        }).catch((err) => console.error("Profile sync failed:", err));

        set((state) => ({
          currentUser: updatedUser,
          usersList: state.usersList.map((u) =>
            u.id === current.id ? updatedUser : u
          )
        }));
      },

      addAddress: async (addressData) => {
        const current = get().currentUser;
        if (!current) return;

        try {
          const res = await fetch("/api/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: current.id, ...addressData })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              const newAddress = data.address;
              const updatedAddresses = [...(current.addresses || []), newAddress];
              const updatedUser: AuthUser = {
                ...current,
                addresses: updatedAddresses
              };
              set((state) => ({
                currentUser: updatedUser,
                usersList: state.usersList.map((u) => u.id === current.id ? updatedUser : u)
              }));
              return newAddress;
            }
          }
        } catch (err) {
          console.error("Failed to add address in PostgreSQL:", err);
        }
      },

      deleteAddress: async (id) => {
        const current = get().currentUser;
        if (!current) return;

        try {
          const res = await fetch(`/api/addresses/${id}`, {
            method: "DELETE"
          });
          if (res.ok) {
            const updatedAddresses = (current.addresses || []).filter((a) => a.id !== id);
            const updatedUser: AuthUser = {
              ...current,
              addresses: updatedAddresses
            };
            set((state) => ({
              currentUser: updatedUser,
              usersList: state.usersList.map((u) => u.id === current.id ? updatedUser : u)
            }));
          }
        } catch (err) {
          console.error("Failed to delete address in PostgreSQL:", err);
        }
      },

      addBooking: (booking) => {
        const current = get().currentUser;
        if (!current) return;

        const newBooking: BookingItem = {
          ...booking,
          id: `B-${Math.floor(1000 + Math.random() * 9000)}`,
          createdAt: new Date().toISOString()
        };

        const updatedBookings = [newBooking, ...(current.bookings || [])];
        const updatedUser: AuthUser = {
          ...current,
          bookings: updatedBookings
        };

        set((state) => ({
          currentUser: updatedUser,
          usersList: state.usersList.map((u) =>
            u.id === current.id ? updatedUser : u
          )
        }));
      },

      fetchUserBookings: async () => {
        const current = get().currentUser;
        if (!current) return;

        try {
          const headers: Record<string, string> = { "x-user-id": current.id };
          if (current.token) {
            headers["Authorization"] = `Bearer ${current.token}`;
          }

          const res = await fetch("/api/bookings", { headers });
          if (res.ok) {
            const dbBookings = await res.json();
            if (!Array.isArray(dbBookings)) return;

            const mappedBookings: BookingItem[] = dbBookings.map((b: any) => ({
              id: b.id,
              service: b.serviceName,
              provider: b.providerName || "Verified Expert",
              providerId: b.providerId,
              date: `${b.date} at ${b.time}`,
              status: b.status || "Requested",
              rating: b.rating,
              reviewComment: b.reviewComment,
              createdAt: b.createdAt
            }));

            set((state) => {
              const latestCurrent = get().currentUser || current;
              const updatedUser = { ...latestCurrent, bookings: mappedBookings };
              return {
                currentUser: updatedUser,
                usersList: state.usersList.map((u) => u.id === latestCurrent.id ? updatedUser : u)
              };
            });
          }
        } catch (e) {
          // Ignore transient network errors during dev server compilation or restarts
        }
      },

      dismissTour: () => {
        const current = get().currentUser;
        if (!current) return;
        const updatedUser: AuthUser = { ...current, isFirstLogin: false };
        set((state) => ({
          currentUser: updatedUser,
          usersList: state.usersList.map((u) => u.id === current.id ? updatedUser : u)
        }));
      },

      restartTour: () => {
        const current = get().currentUser;
        if (!current) return;
        const updatedUser: AuthUser = { ...current, isFirstLogin: true };
        set((state) => ({
          currentUser: updatedUser,
          usersList: state.usersList.map((u) => u.id === current.id ? updatedUser : u)
        }));
      },

      logout: () => {
        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem("belconnect-provider-storage-v2");
            localStorage.removeItem("auth_token");
            localStorage.removeItem("cityconnect_token");
            localStorage.removeItem("cityconnect_auth_token");
            localStorage.removeItem("cityconnect_user_id");
            localStorage.removeItem("user_id");
          }
        } catch (e) {}
        set({ currentUser: null });
      }
    }),
    {
      name: "belconnect-auth-store",
      storage: createJSONStorage(() => localStorage)
    }
  )
);

export function getStoredAuthToken(): string | null {
  const authUser = useAuthStore.getState().currentUser;
  if (authUser?.token) return authUser.token;
  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("cityconnect_auth_token") ||
      localStorage.getItem("cityconnect_token") ||
      localStorage.getItem("auth_token") ||
      null
    );
  }
  return null;
}

export function getStoredUserId(): string | null {
  const authUser = useAuthStore.getState().currentUser;
  if (authUser?.id) return authUser.id;
  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("cityconnect_user_id") ||
      localStorage.getItem("user_id") ||
      null
    );
  }
  return null;
}

