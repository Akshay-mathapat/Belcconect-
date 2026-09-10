"use client";

import { callAudioManager } from "./callAudioManager";

class CustomRingtonePlayer {
  preload() {
    callAudioManager.unlockAudio();
  }

  startRingtone(mode: "incoming" | "outgoing" = "incoming") {
    if (mode === "incoming") {
      callAudioManager.playIncoming();
    } else {
      callAudioManager.playOutgoing();
    }
  }

  stopRingtone() {
    callAudioManager.stopAll();
  }
}

export const ringtonePlayer = new CustomRingtonePlayer();
