"use client";

import { callAudioManager } from "./callAudioManager";

class CustomRingtonePlayer {
  preload() {
    callAudioManager.unlockAudio();
  }

  startRingtone(mode: "incoming" | "outgoing" = "incoming") {
    if (mode === "incoming") {
      void callAudioManager.playIncoming();
    } else {
      void callAudioManager.playOutgoing();
    }
  }

  stopRingtone() {
    callAudioManager.stopAll();
  }
}

export const ringtonePlayer = new CustomRingtonePlayer();
