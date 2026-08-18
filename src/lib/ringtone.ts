"use client";

class Retro80sRingtonePlayer {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private ringInterval: any = null;

  /**
   * Starts playing the authentic 80s dual-tone telephone bell ringtone.
   * @param mode 'incoming' for high-volume double bell ring, 'outgoing' for ringback tone.
   */
  startRingtone(mode: "incoming" | "outgoing" = "incoming") {
    if (this.isPlaying) return;
    this.isPlaying = true;

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
          // Authentic 80s Dual-Gong Mechanical Telephone Bell (440Hz + 480Hz modulated at 25Hz)
          const osc1 = this.audioCtx.createOscillator();
          const osc2 = this.audioCtx.createOscillator();
          const gainNode = this.audioCtx.createGain();

          osc1.type = "sine";
          osc2.type = "sine";

          osc1.frequency.setValueAtTime(440, now);
          osc2.frequency.setValueAtTime(480, now);

          // 25Hz bell hammer vibration tremolo
          const tremolo = this.audioCtx.createOscillator();
          const tremoloGain = this.audioCtx.createGain();
          tremolo.type = "square";
          tremolo.frequency.setValueAtTime(25, now);
          tremoloGain.gain.setValueAtTime(0.4, now);

          tremolo.connect(gainNode.gain);
          tremolo.start(now);

          gainNode.gain.setValueAtTime(0.35, now);
          // Ring duration: 1.8 seconds burst
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
          // Classic 80s Outgoing Telephone Ringback Tone (440Hz + 480Hz soft burst)
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
        console.warn("Audio Context playback error:", err);
      }
    };

    // Play initial burst immediately
    playSingleRingBurst();

    // Repeat ring burst every 3 seconds
    this.ringInterval = setInterval(() => {
      if (this.isPlaying) {
        playSingleRingBurst();
      }
    }, 3000);
  }

  stopRingtone() {
    this.isPlaying = false;
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

export const ringtonePlayer = new Retro80sRingtonePlayer();
