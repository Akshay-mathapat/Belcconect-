"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface PendingCallAction {
  action: "accept" | "incoming" | null;
  callId: string | null;
  bookingId: string | null;
}

interface BelConnectCallPluginInterface {
  getPendingCallAction(): Promise<PendingCallAction>;
  clearPendingCallAction(): Promise<{ cleared: boolean }>;
  dismissCallNotification(options: { callId: string }): Promise<{ dismissed: boolean }>;
  getDevicePushToken(): Promise<{ token: string | null }>;
  setAuthCredentials(options: { token: string; apiUrl?: string }): Promise<{ success: boolean }>;
  startActiveCallService(options: { callId: string; peerName?: string; serviceName?: string }): Promise<{ started: boolean }>;
  stopActiveCallService(): Promise<{ stopped: boolean }>;
  showIncomingCallNotification(options: {
    callId: string;
    callerName?: string;
    serviceName?: string;
    bookingId?: string;
  }): Promise<{ shown: boolean }>;
}

const BelConnectCall = registerPlugin<BelConnectCallPluginInterface>("BelConnectCall");

export const nativeCallBridge = {
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  },

  async startActiveCallService(options: { callId: string; peerName?: string; serviceName?: string }): Promise<void> {
    if (!this.isNative() || !options.callId) return;
    try {
      await BelConnectCall.startActiveCallService(options);
      console.log("[nativeCallBridge] Started active call foreground service for call:", options.callId);
    } catch (err) {
      console.warn("[nativeCallBridge] Error starting active call foreground service:", err);
    }
  },

  async stopActiveCallService(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await BelConnectCall.stopActiveCallService();
      console.log("[nativeCallBridge] Stopped active call foreground service");
    } catch (err) {
      console.warn("[nativeCallBridge] Error stopping active call foreground service:", err);
    }
  },

  async setAuthCredentials(token: string, apiUrl?: string): Promise<void> {
    if (!this.isNative()) return;
    try {
      const url = apiUrl || (typeof window !== "undefined" ? window.location.origin : undefined);
      await BelConnectCall.setAuthCredentials({ token, apiUrl: url });
      console.log("[nativeCallBridge] Synced auth credentials to native background layer");
    } catch (err) {
      console.warn("[nativeCallBridge] Error syncing auth credentials:", err);
    }
  },

  async getPendingCallAction(): Promise<PendingCallAction> {
    if (!this.isNative()) {
      return { action: null, callId: null, bookingId: null };
    }
    try {
      return await BelConnectCall.getPendingCallAction();
    } catch (err) {
      console.warn("[nativeCallBridge] Error getting pending call action:", err);
      return { action: null, callId: null, bookingId: null };
    }
  },

  async clearPendingCallAction(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await BelConnectCall.clearPendingCallAction();
    } catch (err) {
      console.warn("[nativeCallBridge] Error clearing pending call action:", err);
    }
  },

  async dismissNativeCall(callId: string): Promise<void> {
    if (!this.isNative() || !callId) return;
    try {
      await BelConnectCall.dismissCallNotification({ callId });
    } catch (err) {
      console.warn("[nativeCallBridge] Error dismissing native notification:", err);
    }
  },

  async showIncomingCallNotification(options: {
    callId: string;
    callerName?: string;
    serviceName?: string;
    bookingId?: string;
  }): Promise<void> {
    if (!this.isNative() || !options.callId) return;
    try {
      await BelConnectCall.showIncomingCallNotification(options);
      console.log("[nativeCallBridge] Displayed native incoming call heads-up notification for call:", options.callId);
    } catch (err) {
      console.warn("[nativeCallBridge] Error showing native incoming call notification:", err);
    }
  },

  async syncNativeDeviceToken(userId: string): Promise<void> {
    if (!this.isNative() || !userId) return;
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token")
          : null;

      if (token) {
        await this.setAuthCredentials(token);
      }

      const res = await BelConnectCall.getDevicePushToken();
      if (res?.token) {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token")
            : null;

        await fetch("/api/device/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            token: res.token,
            platform: "android"
          })
        });
        console.log("[nativeCallBridge] Successfully registered native device token for user:", userId);
      }
    } catch (err) {
      console.warn("[nativeCallBridge] Could not sync native device push token:", err);
    }
  }
};

