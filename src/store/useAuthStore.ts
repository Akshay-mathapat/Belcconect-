"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserRole = "user" | "provider" | "job_provider";

export interface SavedAddress {
  id: string;
  type: string; // e.g. "Home", "Office", "Other"
  text: string;
}

export interface BookingItem {
  id: string;
  service: string;
  provider: string;
  date: string;
  status: "Requested" | "Accepted" | "Rejected" | "OnTheWay" | "Started" | "Completed" | "Cancelled" | "Upcoming";
  price?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  addresses?: SavedAddress[];
  bookings?: BookingItem[];
}

interface AuthState {
  currentUser: AuthUser | null;
  usersList: AuthUser[];

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

  addAddress: (data: { type: string; text: string }) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;

  addBooking: (booking: Omit<BookingItem, "id">) => void;
  fetchUserBookings: () => Promise<void>;

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
            const user = data.user;
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
            const user = data.user;
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

      addAddress: async ({ type, text }) => {
        const current = get().currentUser;
        if (!current) return;

        try {
          const res = await fetch("/api/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: current.id, type, text })
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
          id: `B-${Math.floor(1000 + Math.random() * 9000)}`
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
          const res = await fetch("/api/bookings", {
            headers: { "x-user-id": current.id }
          });
          if (res.ok) {
            const dbBookings = await res.json();
            // Map DB bookings schema to fit customer layout (BookingItem)
            const mappedBookings: BookingItem[] = dbBookings.map((b: any) => ({
              id: b.id,
              service: b.serviceName,
              provider: b.providerName || (b.providerId === "provider-1" ? "Rohan Electrician" : "Verified Expert"),
              date: `${b.date} at ${b.time}`,
              status: b.status || "Requested",
              price: `₹${b.price}`
            }));

            set((state) => {
              const updatedUser = { ...current, bookings: mappedBookings };
              return {
                currentUser: updatedUser,
                usersList: state.usersList.map((u) => u.id === current.id ? updatedUser : u)
              };
            });
          }
        } catch (e) {
          console.error("Failed to load user bookings from PostgreSQL:", e);
        }
      },

      logout: () => {
        set({ currentUser: null });
      }
    }),
    {
      name: "belconnect-auth-store",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
