"use client";

class CustomRingtonePlayer {
  private audioElement: HTMLAudioElement | null = null;
  private isPlaying = false;
  private audioCtx: AudioContext | null = null;
  private ringInterval: any = null;

  /**
   * Starts playing the custom ringtone sound file.
   * @param mode 'incoming' for full volume ringtone, 'outgoing' for ringback sound.
   */
  startRingtone(mode: "incoming" | "outgoing" = "incoming") {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (typeof window === "undefined") return;

    try {
      if (!this.audioElement) {
        this.audioElement = new Audio("/sounds/ringtone.wav");
      }

      this.audioElement.currentTime = 0;
      this.audioElement.loop = true;
      this.audioElement.volume = mode === "incoming" ? 1.0 : 0.6;

      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch((err: any) => {
          // Ignore AbortError caused by quick pause()/stopRingtone() when call is accepted/rejected fast
          if (err?.name === "AbortError" || String(err?.message || err).includes("interrupted by a call to pause")) {
            return;
          }
          if (!this.isPlaying) return;
          console.warn("Autoplay prevented custom ringtone, falling back to Web Audio API...", err);
          this.startWebAudioFallback(mode);
        });
      }
    } catch (e) {
      if (!this.isPlaying) return;
      console.warn("Audio element error, using Web Audio fallback:", e);
      this.startWebAudioFallback(mode);
    }
  }

  private startWebAudioFallback(mode: "incoming" | "outgoing") {
    if (!this.isPlaying) return;

    const playSingleRingBurst = () => {
      if (!this.isPlaying) return;

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        if (!this.audioCtx || this.audioCtx.state === "closed") {
          this.audioCtx = new AudioContextClass();
        }

        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;

        if (mode === "incoming") {
          const osc1 = this.audioCtx.createOscillator();
          const osc2 = this.audioCtx.createOscillator();
          const gainNode = this.audioCtx.createGain();

          osc1.type = "sine";
          osc2.type = "sine";

          osc1.frequency.setValueAtTime(440, now);
          osc2.frequency.setValueAtTime(480, now);

          const tremolo = this.audioCtx.createOscillator();
          const tremoloGain = this.audioCtx.createGain();
          tremolo.type = "square";
          tremolo.frequency.setValueAtTime(25, now);
          tremoloGain.gain.setValueAtTime(0.4, now);

          tremolo.connect(gainNode.gain);
          tremolo.start(now);

          gainNode.gain.setValueAtTime(0.35, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(this.audioCtx.destination);

          osc1.start(now);
          osc2.start(now);

          osc1.stop(now + 1.8);
          osc2.stop(now + 1.8);
          tremolo.stop(now + 1.8);
        } else {
          const osc1 = this.audioCtx.createOscillator();
          const osc2 = this.audioCtx.createOscillator();
          const gainNode = this.audioCtx.createGain();

          osc1.type = "sine";
          osc2.type = "sine";

          osc1.frequency.setValueAtTime(440, now);
          osc2.frequency.setValueAtTime(480, now);

          gainNode.gain.setValueAtTime(0.18, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(this.audioCtx.destination);

          osc1.start(now);
          osc2.start(now);

          osc1.stop(now + 1.5);
          osc2.stop(now + 1.5);
        }
      } catch (err) {
        console.warn("Web Audio fallback error:", err);
      }
    };

    playSingleRingBurst();
    this.ringInterval = setInterval(() => {
      if (this.isPlaying) {
        playSingleRingBurst();
      }
    }, 3000);
  }

  stopRingtone() {
    this.isPlaying = false;

    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch (e) {}
    }

    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }
  }
}

export const ringtonePlayer = new CustomRingtonePlayer();
