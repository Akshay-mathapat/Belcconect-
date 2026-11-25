"use client";

// Reusable booking audio and visual alert manager for BelConnect service providers
// Plays an audible 10-second ringtone when a new customer booking is received.

export interface ActiveBookingAlert {
  bookingId: string;
  customerName: string;
  serviceName: string;
  date: string;
  time?: string;
  address?: string;
  visitingCharge?: number;
}

type AlertListener = (alert: ActiveBookingAlert | null) => void;

class BookingAlertManager {
  private audioElement: HTMLAudioElement | null = null;
  private autoStopTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentAlert: ActiveBookingAlert | null = null;
  private listeners: Set<AlertListener> = new Set();
  private isUnlocked = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.attachUnlockListener();
    }
  }

  private attachUnlockListener() {
    const unlock = () => {
      if (this.isUnlocked) return;
      this.ensureAudioElement();
      if (this.audioElement) {
        // Silent touch to unlock browser audio restrictions
        this.audioElement.volume = 0;
        this.audioElement
          .play()
          .then(() => {
            this.audioElement?.pause();
            this.audioElement!.currentTime = 0;
            this.audioElement!.volume = 1.0;
            this.isUnlocked = true;
          })
          .catch(() => {});
      }
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("click", unlock, { once: true, passive: true });
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
  }

  private ensureAudioElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.audioElement) {
      const audio = new Audio("/sounds/phone-ringing.mp3");
      audio.loop = true;
      audio.preload = "auto";
      audio.addEventListener("error", () => {
        if (audio.src.includes("phone-ringing")) {
          audio.src = "/sounds/belconnect_incoming_call.mp3";
        }
      });
      this.audioElement = audio;
    }
    return this.audioElement;
  }

  /**
   * Subscribe to alert state changes (e.g. for showing a banner or modal in UI)
   */
  public subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    // Send immediate current state
    listener(this.currentAlert);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentAlert);
      } catch (e) {
        console.warn("[BookingAlert] Error in listener:", e);
      }
    }
  }

  /**
   * Triggers a 10-second booking ringtone alert
   */
  public triggerAlert(alertData: ActiveBookingAlert): void {
    if (typeof window === "undefined") return;

    // Avoid duplicate ringing for the exact same booking if already active
    if (this.currentAlert?.bookingId === alertData.bookingId) {
      return;
    }

    this.stopAlert();

    this.currentAlert = {
      ...alertData,
      visitingCharge: alertData.visitingCharge || 250
    };
    this.notify();

    const audio = this.ensureAudioElement();
    if (audio) {
      try {
        audio.currentTime = 0;
        audio.volume = 1.0;
        audio.loop = true;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.log("[BookingAlert] Autoplay was prevented by browser:", err);
          });
        }
      } catch (err) {
        console.warn("[BookingAlert] Error starting audio:", err);
      }
    }

    // Trigger phone vibration if available (10s pattern)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([600, 300, 600, 300, 600, 300, 600, 300, 1000]);
      } catch (e) {}
    }

    // Hard 10-second auto-stop limit
    this.autoStopTimeout = setTimeout(() => {
      this.stopSoundOnly();
    }, 10000);
  }

  /**
   * Stops the ringtone sound but leaves the notification card visible
   */
  public stopSoundOnly(): void {
    if (this.autoStopTimeout) {
      clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }

    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch (e) {}
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }
  }

  /**
   * Completely dismisses the ringtone and alert
   */
  public stopAlert(): void {
    this.stopSoundOnly();
    if (this.currentAlert) {
      this.currentAlert = null;
      this.notify();
    }
  }

  public getCurrentAlert(): ActiveBookingAlert | null {
    return this.currentAlert;
  }
}

export const bookingAlertManager = new BookingAlertManager();
