"use client";

import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import ChatWindow from "./ChatWindow";

import { useTranslation } from "@/lib/i18n";

interface ChatButtonProps {
  customerId?: string;
  providerId?: string;
  bookingId?: string;
  peerName?: string;
  peerAvatar?: string;
  serviceName?: string;
  bookingStatus?: string;
  className?: string;
  title?: string;
}

export default function ChatButton({
  customerId,
  providerId,
  bookingId,
  peerName,
  peerAvatar,
  serviceName,
  bookingStatus,
  className,
  title
}: ChatButtonProps) {
  const { currentUser } = useAuthStore();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const activeUserId = currentUser?.id || "customer-1";
  const targetCustId = customerId || (activeUserId.startsWith("customer") ? activeUserId : "customer-1");
  const targetProvId = providerId || (activeUserId.startsWith("provider") ? activeUserId : "provider-1");
  const targetPeerName = peerName || (activeUserId.startsWith("provider") ? "Customer" : "Verified Provider");
  const targetPeerId = activeUserId === targetCustId ? targetProvId : targetCustId;

  const displayTitle = title
    ? (t(title) !== title
        ? t(title)
        : t(`common.${title.toLowerCase()}`) !== `common.${title.toLowerCase()}`
          ? t(`common.${title.toLowerCase()}`)
          : title)
    : t("common.chat");

  const handleOpenChat = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: targetCustId,
          providerId: targetProvId,
          bookingId
        })
      });

      if (!res.ok) throw new Error("Failed to create/get conversation");

      const data = await res.json();
      setActiveConvId(data.conversationId);
      setIsOpen(true);
    } catch (err) {
      console.error("Chat error:", err);
      alert("Unable to open chat session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenChat}
        disabled={loading}
        className={className || "px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"}
        title={displayTitle}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
        <span>{displayTitle}</span>
      </button>

      {isOpen && activeConvId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl h-[85vh] max-h-[700px] my-auto flex">
            <ChatWindow
              conversationId={activeConvId}
              peerName={targetPeerName}
              peerAvatar={peerAvatar}
              peerId={targetPeerId}
              bookingId={bookingId}
              serviceName={serviceName}
              bookingStatus={bookingStatus}
              currentUserId={activeUserId}
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
