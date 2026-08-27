"use client";

import { CallRecord } from "@/lib/calls";
import LiveKitVoiceCall, { LiveKitCredentials } from "./LiveKitVoiceCall";

interface ActiveCallProps {
  call: CallRecord;
  livekit: LiveKitCredentials | null;
  currentUserId: string;
  onEndCall: () => void;
}

export default function ActiveCall({
  call,
  livekit,
  currentUserId,
  onEndCall
}: ActiveCallProps) {
  return (
    <LiveKitVoiceCall
      call={call}
      livekit={livekit}
      currentUserId={currentUserId}
      onEndCall={onEndCall}
    />
  );
}
