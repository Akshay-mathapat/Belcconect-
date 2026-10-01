"use client";

import { registerPlugin } from "@capacitor/core";

export interface ProviderLocationPlugin {
  startTracking(options: {
    bookingId: string;
    userId?: string;
    token?: string;
    apiUrl?: string;
    endpoint?: string;
    [key: string]: any;
  }): Promise<any>;

  stopTracking(options?: { bookingId?: string; [key: string]: any }): Promise<any>;
}

export const ProviderLocation: ProviderLocationPlugin =
  typeof window !== "undefined"
    ? registerPlugin<ProviderLocationPlugin>("ProviderLocation")
    : (null as unknown as ProviderLocationPlugin);
