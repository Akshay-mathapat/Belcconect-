"use client";

import { authFetch } from "@/lib/authFetch";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nativeCallBridge } from "@/lib/nativeCallBridge";
import { recreateChatSocket, disconnectChatSocket } from "@/lib/socketChat";

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
  }) => Promise<{
    success: boolean;
    error?: string;
    user?: AuthUser;
    status?: number;
    retryAfterSeconds?: number;
  }>;

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
  fetchUserAddresses: () => Promise<void>;

  dismissTour: () => void;
  restartTour: () => void;

  logout: () => void;
}

const INITIAL_USERS: AuthUser[] = [];

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              password: password || "password123"
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          let data: any = {};
          try {
            data = await res.json();
          } catch {
            data = {};
          }

          if (res.ok && data.success) {
            const user: AuthUser = {
              bookings: [],
              addresses: [],
              ...data.user,
              token: data.token
            };

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
              // Immediately reconnect chat socket with fresh credentials
              try {
                recreateChatSocket(user.id);
              } catch (e) {}
            }

            set((state) => {
              const list = state.usersList.map((u) => (u.id === user.id ? user : u));
              return { currentUser: user, usersList: list };
            });

            // If user has customer role, asynchronously load saved addresses via authenticated endpoint
            if (user.role === "user") {
              authFetch("/api/addresses")
                .then((r) => r.ok ? r.json() : [])
                .then((addresses) => {
                  if (Array.isArray(addresses)) {
                    set((state) => {
                      if (!state.currentUser || state.currentUser.id !== user.id) return state;
                      const updated = { ...state.currentUser, addresses };
                      return { currentUser: updated };
                    });
                  }
                })
                .catch(() => {});
            }

            return { success: true, user, status: 200 };
          }

          // Handle specific HTTP failure statuses
          const retryAfterHeader = res.headers.get("Retry-After");
          const retryAfterSeconds = retryAfterHeader
            ? parseInt(retryAfterHeader, 10)
            : data.retryAfterSeconds;

          if (res.status === 401) {
            return {
              success: false,
              status: 401,
              error: data.error || "Incorrect email or password. Please try again."
            };
          }

          if (res.status === 429) {
            return {
              success: false,
              status: 429,
              retryAfterSeconds,
              error:
                data.error ||
                `Too many login attempts. Please try again in ${retryAfterSeconds || 60} seconds.`
            };
          }

          if (res.status === 503) {
            return {
              success: false,
              status: 503,
              retryAfterSeconds,
              error: "Database or server connection is busy. Please try again in a few moments."
            };
          }

          return {
            success: false,
            status: res.status,
            error: data.error || "Login failed. Please check your credentials."
          };
        } catch (e: any) {
          clearTimeout(timeoutId);
          console.error("Login API error:", e);
          if (e.name === "AbortError") {
            return {
              success: false,
              status: 408,
              error: "Login request timed out after 20 seconds. Please check your network connection."
            };
          }
          return {
            success: false,
            status: 0,
            error: "Unable to connect to the server. Please check your network connection."
          };
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
        const token = current.token || (typeof window !== "undefined" ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") : null);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        fetch("/api/auth/sync", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: name !== undefined ? name : current.name,
            phone: phone !== undefined ? phone : current.phone,
            avatar: avatar !== undefined ? avatar : current.avatar
          })
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
          const token = current.token || (typeof window !== "undefined" ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") : null);
          const headers: Record<string, string> = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          const res = await fetch(`/api/addresses/${id}`, {
            method: "DELETE",
            headers
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

          const res = await authFetch("/api/bookings", { headers });
          if (res.ok) {
            const dbBookings = await res.json();
            if (!Array.isArray(dbBookings)) return;

            const mappedBookings: BookingItem[] = dbBookings.map((b: any) => ({
              id: b.id,
              service: b.serviceName,
              provider: b.providerName || "Service Provider",
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

      fetchUserAddresses: async () => {
        const current = get().currentUser;
        if (!current) return;

        try {
          const headers: Record<string, string> = { "x-user-id": current.id };
          if (current.token) {
            headers["Authorization"] = `Bearer ${current.token}`;
          }

          const res = await authFetch("/api/addresses", { headers });
          if (res.ok) {
            const addresses = await res.json();
            if (!Array.isArray(addresses)) return;

            set((state) => {
              const latestCurrent = get().currentUser || current;
              const updatedUser = { ...latestCurrent, addresses };
              return {
                currentUser: updatedUser,
                usersList: state.usersList.map((u) => u.id === latestCurrent.id ? updatedUser : u)
              };
            });
          }
        } catch (err) {
          console.error("Failed to fetch user addresses:", err);
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
        const currentToken = getStoredAuthToken();
        const currentUid = getStoredUserId();

        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem("belconnect-provider-storage-v2");
            localStorage.removeItem("auth_token");
            localStorage.removeItem("cityconnect_token");
            localStorage.removeItem("cityconnect_auth_token");
            localStorage.removeItem("cityconnect_user_id");
            localStorage.removeItem("user_id");
            try {
              disconnectChatSocket();
            } catch (e) {}
          }
        } catch (e) {}

        // Unregister device push token and clear native bridge credentials
        if (typeof window !== "undefined") {
          try {
            nativeCallBridge.setAuthCredentials("", "").catch(() => {});
            if (currentToken && nativeCallBridge.isNative()) {
              nativeCallBridge.getDevicePushToken().then((devToken: string | null) => {
                fetch("/api/device/unregister", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`,
                    ...(currentUid ? { "x-user-id": currentUid } : {})
                  },
                  body: JSON.stringify({ token: devToken || undefined })
                }).catch(() => {});
              }).catch(() => {});
            }
          } catch (e) {}
        }

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
  if (authUser?.token && typeof authUser.token === "string" && authUser.token !== "undefined" && authUser.token !== "null" && authUser.token.trim().length > 10) {
    return authUser.token.trim();
  }
  if (typeof window !== "undefined") {
    const keys = ["cityconnect_auth_token", "cityconnect_token", "auth_token"];
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val && typeof val === "string" && val !== "undefined" && val !== "null" && val.trim().length > 10) {
        return val.trim();
      }
    }
    try {
      const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
      if (match && match[1] && match[1] !== "undefined" && match[1] !== "null" && match[1].trim().length > 10) {
        return decodeURIComponent(match[1].trim());
      }
    } catch (e) {}
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


// Global listener for central auth:expired event (PART 2)
if (typeof window !== "undefined") {
  window.addEventListener("auth:expired", () => {
    try {
      const store = useAuthStore.getState();
      if (store.currentUser) {
        console.warn("[AUTH] Session expired. Clearing authenticated state and redirecting.");
        store.logout();
        const path = window.location.pathname;
        if (!path.startsWith("/login") && !path.startsWith("/auth") && !path.startsWith("/register")) {
          window.location.href = `/login?expired=1&returnTo=${encodeURIComponent(path)}`;
        }
      }
    } catch (e) {
      console.error("[AUTH] Error handling auth:expired:", e);
    }
  });
}
