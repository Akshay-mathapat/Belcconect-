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
  status: "Upcoming" | "Completed" | "Cancelled";
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
    name: string;
    phone?: string;
    role: UserRole;
  }) => { success: boolean; error?: string; user?: AuthUser };

  loginUser: (data: {
    email: string;
    role: UserRole;
  }) => { success: boolean; error?: string; user?: AuthUser };

  updateProfile: (data: {
    name?: string;
    phone?: string;
    avatar?: string;
  }) => void;

  addAddress: (data: { type: string; text: string }) => void;
  deleteAddress: (id: string) => void;

  addBooking: (booking: Omit<BookingItem, "id">) => void;

  logout: () => void;
}

const INITIAL_USERS: AuthUser[] = [
  {
    id: "user-1",
    email: "customer@belconnect.com",
    name: "Akshay Mathapati",
    phone: "+91 98765 43210",
    role: "user",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    addresses: [
      { id: "addr-1", type: "Home", text: "123 Main St, Tilakwadi, Belagavi, 590006" },
      { id: "addr-2", type: "Office", text: "45 Business Park, Camp, Belagavi, 590001" }
    ],
    bookings: [] // No fake bookings by default! Real empty state.
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
    id: "job-1",
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

      registerUser: ({ email, name, phone, role }) => {
        const cleanEmail = email.trim().toLowerCase();
        const existingUsers = get().usersList;

        const isDuplicate = existingUsers.some(
          (u) => u.email.trim().toLowerCase() === cleanEmail
        );

        if (isDuplicate) {
          return {
            success: false,
            error: "An account with this email address already exists. Please sign in instead."
          };
        }

        const newUser: AuthUser = {
          id: `user-${Date.now()}`,
          email: cleanEmail,
          name: name || "BelConnect User",
          phone: phone || "+91 98765 00000",
          role,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || cleanEmail)}`,
          addresses: [],
          bookings: []
        };

        set((state) => ({
          usersList: [...state.usersList, newUser],
          currentUser: newUser
        }));

        return { success: true, user: newUser };
      },

      loginUser: ({ email, role }) => {
        const cleanEmail = email.trim().toLowerCase();
        const existingUsers = get().usersList;

        let user = existingUsers.find(
          (u) => u.email.trim().toLowerCase() === cleanEmail
        );

        if (user) {
          user = { ...user, role };
        } else {
          user = {
            id: `user-${Date.now()}`,
            email: cleanEmail,
            name: cleanEmail.split("@")[0] || "User",
            phone: "+91 98765 00000",
            role,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
            addresses: [],
            bookings: []
          };

          set((state) => ({
            usersList: [...state.usersList, user!]
          }));
        }

        set({ currentUser: user });
        return { success: true, user };
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

        set((state) => ({
          currentUser: updatedUser,
          usersList: state.usersList.map((u) =>
            u.id === current.id ? updatedUser : u
          )
        }));
      },

      addAddress: ({ type, text }) => {
        const current = get().currentUser;
        if (!current) return;

        const newAddress: SavedAddress = {
          id: `addr-${Date.now()}`,
          type: type || "Home",
          text
        };

        const updatedAddresses = [...(current.addresses || []), newAddress];
        const updatedUser: AuthUser = {
          ...current,
          addresses: updatedAddresses
        };

        set((state) => ({
          currentUser: updatedUser,
          usersList: state.usersList.map((u) =>
            u.id === current.id ? updatedUser : u
          )
        }));
      },

      deleteAddress: (id) => {
        const current = get().currentUser;
        if (!current) return;

        const updatedAddresses = (current.addresses || []).filter((a) => a.id !== id);
        const updatedUser: AuthUser = {
          ...current,
          addresses: updatedAddresses
        };

        set((state) => ({
          currentUser: updatedUser,
          usersList: state.usersList.map((u) =>
            u.id === current.id ? updatedUser : u
          )
        }));
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
