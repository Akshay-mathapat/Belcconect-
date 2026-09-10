// Reusable client-side call audio manager for incoming ringtone and caller ringback
// Strictly client-only, lazy-created, reused, looped, idempotent.

class CallAudioManager {
  private incomingAudio: HTMLAudioElement | null = null;
  private outgoingAudio: HTMLAudioElement | null = null;
  private incomingPlaying = false;
  private outgoingPlaying = false;
  private currentCallId: string | null = null;
  private isConnectingOrConnected = false;
  private hasLoggedIncomingAutoplayBlock = false;
  private hasLoggedOutgoingAutoplayBlock = false;
  private hasLoggedOutgoingMissingAsset = false;
  private unlocked = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.setupGestureUnlock();
    }
  }

  /**
   * Sets the current call lifecycle state to prevent ringing while connecting or active.
   */
  public setCallState(state: string): void {
    if (state === "ACTIVE" || state === "ACCEPTING" || state === "connecting" || state === "connected") {
      this.isConnectingOrConnected = true;
      this.stopAll();
    } else if (state === "IDLE") {
      this.isConnectingOrConnected = false;
      this.stopAll();
    } else {
      this.isConnectingOrConnected = false;
    }
  }

  /**
   * Sets or updates current active call ID without interrupting ongoing playback.
   */
  public setCallId(callId: string | null): void {
    this.currentCallId = callId;
  }

  /**
   * One-time user gesture listener to unlock audio on modern browsers / WebViews.
   */
  private setupGestureUnlock() {
    if (typeof window === "undefined") return;

    const unlockHandler = () => {
      this.unlockAudio();
      window.removeEventListener("click", unlockHandler);
      window.removeEventListener("touchstart", unlockHandler);
      window.removeEventListener("keydown", unlockHandler);
    };

    window.addEventListener("click", unlockHandler, { passive: true });
    window.addEventListener("touchstart", unlockHandler, { passive: true });
    window.addEventListener("keydown", unlockHandler, { passive: true });
  }

  /**
   * Initializes audio elements on first user gesture to satisfy browser autoplay policies.
   */
  public unlockAudio(): void {
    if (typeof window === "undefined" || this.unlocked) return;
    this.unlocked = true;

    try {
      this.ensureIncomingAudio();
      this.ensureOutgoingAudio();
    } catch {
      // Non-critical: Audio elements will initialize on demand
    }
  }

  private ensureIncomingAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.incomingAudio) {
      try {
        const audio = new Audio("/sounds/phone-ringing.mp3");
        audio.loop = true;
        audio.preload = "auto";
        this.incomingAudio = audio;
      } catch (err) {
        console.warn("[CallAudio] Failed to initialize incoming audio element:", err);
      }
    }
    return this.incomingAudio;
  }

  private ensureOutgoingAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.outgoingAudio) {
      try {
        const audio = new Audio("/sounds/outgoing-ring.mp3");
        audio.loop = true;
        audio.preload = "auto";

        audio.addEventListener("error", () => {
          if (!this.hasLoggedOutgoingMissingAsset) {
            this.hasLoggedOutgoingMissingAsset = true;
            console.warn(
              "[CallAudio] public/sounds/outgoing-ring.mp3 could not be loaded. Asset needs to be supplied."
            );
          }
          this.outgoingPlaying = false;
        });

        this.outgoingAudio = audio;
      } catch (err) {
        console.warn("[CallAudio] Failed to initialize outgoing audio element:", err);
      }
    }
    return this.outgoingAudio;
  }

  /**
   * Plays the incoming ringtone (looping).
   * Idempotent: Does NOT restart or reset currentTime if already playing.
   */
  public playIncoming(callId?: string): Promise<void> | void {
    if (typeof window === "undefined") return;

    // State Protection: never play if connecting or connected
    if (this.isConnectingOrConnected) {
      console.log("[CallAudio] playIncoming ignored: call is connecting or connected");
      return;
    }

    // Mutually exclusive: Stop outgoing ringback if active
    this.stopOutgoing();

    // Idempotency check: if already playing for the same callId, do not restart
    if (callId && this.currentCallId === callId && this.incomingPlaying) {
      return;
    }

    if (callId) {
      this.currentCallId = callId;
    }

    const audio = this.ensureIncomingAudio();
    if (!audio) return;

    // Idempotency check: if already playing and not paused, do not restart
    // If already playing and not paused, do not restart
    if (this.incomingPlaying && !audio.paused) {
      return;
    }

    this.incomingPlaying = true;
    console.log("[CallAudio] incoming start");
    console.log("[CallAudio] incoming start (callId=" + (callId || "unknown") + ")");

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      return playPromise.catch((error: any) => {
        // AbortError is benign if call was answered/rejected immediately
        if (
          error?.name === "AbortError" ||
          String(error?.message || error).includes("interrupted by a call to pause")
        ) {
          return;
        }

        if (!this.hasLoggedIncomingAutoplayBlock) {
          this.hasLoggedIncomingAutoplayBlock = true;
          console.warn("[CallAudio] playback blocked:", error);
        }
        this.incomingPlaying = false;
      });
    }
  }

  /**
   * Stops the incoming ringtone and resets currentTime to 0.
   */
  public stopIncoming(): void {
    if (typeof window === "undefined") return;

    if (!this.incomingPlaying && (!this.incomingAudio || this.incomingAudio.paused)) {
      return;
    }

    this.incomingPlaying = false;
    this.hasLoggedIncomingAutoplayBlock = false;

    if (this.incomingAudio) {
      try {
        this.incomingAudio.pause();
        this.incomingAudio.currentTime = 0;
        console.log("[CallAudio] incoming stop");
      } catch {
        // Safe to ignore on already paused audio
      }
    }
  }

  /**
   * Plays the outgoing caller ringback (looping).
   * Idempotent: Does NOT restart or reset currentTime if already playing.
   */
  public playOutgoing(callId?: string): Promise<void> | void {
    if (typeof window === "undefined") return;

    // State Protection: never play if connecting or connected
    if (this.isConnectingOrConnected) {
      console.log("[CallAudio] playOutgoing ignored: call is connecting or connected");
      return;
    }

    // Mutually exclusive: Stop incoming ringtone if active
    this.stopIncoming();

    // Idempotency check: if already playing for the same callId, do not restart
    if (callId && this.currentCallId === callId && this.outgoingPlaying) {
      return;
    }

    if (callId) {
      this.currentCallId = callId;
    }

    const audio = this.ensureOutgoingAudio();
    if (!audio) return;

    // Idempotency check: if already playing and not paused, do not restart
    // If already playing and not paused, do not restart
    if (this.outgoingPlaying && !audio.paused) {
      return;
    }

    this.outgoingPlaying = true;
    console.log("[CallAudio] outgoing start");
    console.log("[CallAudio] outgoing start (callId=" + (callId || "unknown") + ")");

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      return playPromise.catch((error: any) => {
        if (
          error?.name === "AbortError" ||
          String(error?.message || error).includes("interrupted by a call to pause")
        ) {
          return;
        }

        if (!this.hasLoggedOutgoingAutoplayBlock) {
          this.hasLoggedOutgoingAutoplayBlock = true;
          console.warn("[CallAudio] playback blocked:", error);
        }
        this.outgoingPlaying = false;
      });
    }
  }

  /**
   * Stops the outgoing ringback and resets currentTime to 0.
   */
  public stopOutgoing(): void {
    if (typeof window === "undefined") return;

    if (!this.outgoingPlaying && (!this.outgoingAudio || this.outgoingAudio.paused)) {
      return;
    }

    this.outgoingPlaying = false;
    this.hasLoggedOutgoingAutoplayBlock = false;

    if (this.outgoingAudio) {
      try {
        this.outgoingAudio.pause();
        this.outgoingAudio.currentTime = 0;
        console.log("[CallAudio] outgoing stop");
      } catch {
        // Safe to ignore on already paused audio
      }
    }
  }

  /**
   * Stops all call audio immediately (incoming ringtone & outgoing ringback).
   * Safe to call repeatedly.
   */
  public stopAll(): void {
    this.stopIncoming();
    this.stopOutgoing();
    this.currentCallId = null;
  }
}

// Export ONE shared instance across the entire application
export const callAudioManager = new CallAudioManager();
