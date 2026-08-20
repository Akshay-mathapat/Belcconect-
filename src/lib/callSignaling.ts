import { EventEmitter } from "events";
import { CallRecord } from "@/lib/calls";

export type SignalingEventType =
  | "call:initiate"
  | "call:ring"
  | "call:accept"
  | "call:reject"
  | "call:end"
  | "call:missed"
  | "call:busy"
  | "call:cancel";

export interface SignalingEvent {
  type: SignalingEventType;
  call: CallRecord;
  agora?: {
    appId: string;
    channelName: string;
    token: string;
    uid: number;
  };
  timestamp: number;
}

class CallSignalingManager extends EventEmitter {
  private userListeners: Map<string, Set<(event: SignalingEvent) => void>> = new Map();

  public subscribeUser(userId: string, callback: (event: SignalingEvent) => void): () => void {
    if (!this.userListeners.has(userId)) {
      this.userListeners.set(userId, new Set());
    }
    this.userListeners.get(userId)!.add(callback);

    return () => {
      const set = this.userListeners.get(userId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.userListeners.delete(userId);
        }
      }
    };
  }

  public broadcastToUser(userId: string, event: SignalingEvent) {
    if (!userId) return;
    const listeners = this.userListeners.get(userId);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(event);
        } catch (e) {
          console.error(`Error delivering call signal to user ${userId}:`, e);
        }
      });
    }
  }

  public emitCallEvent(event: SignalingEvent) {
    if (!event || !event.call) return;
    const { callerId, receiverId } = event.call;

    // Send to both caller and receiver IDs
    this.broadcastToUser(callerId, event);
    this.broadcastToUser(receiverId, event);

    // Also broadcast to demo user aliases if needed for local cross-tab testing
    if (callerId.includes("cust") || callerId === "customer-1") {
      this.broadcastToUser("customer-1", event);
    }
    if (receiverId.includes("prov") || receiverId === "provider-1") {
      this.broadcastToUser("provider-1", event);
    }
    if (callerId.includes("prov") || callerId === "provider-1") {
      this.broadcastToUser("provider-1", event);
    }
    if (receiverId.includes("cust") || receiverId === "customer-1") {
      this.broadcastToUser("customer-1", event);
    }
  }
}

export const callSignaling = new CallSignalingManager();
