"use client";

import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  Search, 
  ChevronLeft,
  Loader2,
  User
} from "lucide-react";
import ChatWindow from "@/components/chat/ChatWindow";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslation } from "@/lib/i18n";

interface ConversationMeta {
  id: string;
  customerId: string;
  providerId: string;
  bookingId?: string;
  serviceName?: string;
  bookingStatus?: string;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function MessagesPage() {
  const { currentUser } = useAuthStore();
  const { t } = useTranslation();
  const providerId = currentUser?.id || (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "provider-1" : "");

  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showChatMobile, setShowChatMobile] = useState(false);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`/api/chat/conversations?userId=${providerId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setConversations(data);
          if (!activeConvId && data.length > 0) {
            setActiveConvId(data[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching provider conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [providerId]);

  const activeConv = conversations.find((c) => c.id === activeConvId) || conversations[0];

  const filteredConversations = conversations.filter((c) =>
    c.peerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.serviceName && c.serviceName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectConv = (id: string) => {
    setActiveConvId(id);
    setShowChatMobile(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm h-[calc(100vh-160px)] sm:h-[calc(100vh-140px)] flex flex-col md:flex-row overflow-hidden">
      
      {/* Left Pane: Customer List (Hidden on mobile when chat is open) */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-border flex-col justify-between shrink-0 bg-muted/10 ${
        showChatMobile ? "hidden md:flex" : "flex"
      }`}>
        <div>
          <div className="p-4 border-b border-border space-y-3">
            <h2 className="font-heading text-lg font-bold text-foreground flex items-center justify-between">
              <span>{t("serviceProvider.customerConversations")}</span>
              <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">
                {conversations.length} {t("serviceProvider.active")}
              </span>
            </h2>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("serviceProvider.searchMessagesOrCustomers")}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>
          </div>

          <div className="divide-y divide-border/50 max-h-[calc(100vh-250px)] overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                <span className="text-xs font-semibold">{t("chat.loadingChats")}</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {t("chat.noCustomerChatsFound")}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeConvId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConv(conv.id)}
                    className={`w-full p-4 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected ? "bg-blue-500/10 border-l-4 border-blue-600" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={conv.peerAvatar}
                        alt={conv.peerName}
                        className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                      />
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="overflow-hidden flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground truncate">{conv.peerName}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{conv.lastMessageTime}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                      {conv.serviceName && (
                        <span className="inline-block mt-1 text-[9px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-500/10 px-1.5 py-0.2 rounded">
                          {conv.serviceName}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Pane: Active Chat Window (Hidden on mobile when chat is NOT open) */}
      {activeConv ? (
        <div className={`flex-1 flex-col justify-between bg-card min-w-0 ${
          !showChatMobile ? "hidden md:flex" : "flex"
        }`}>
          {/* Mobile Back Button Bar */}
          <div className="md:hidden p-2 border-b border-border bg-card">
            <button
              onClick={() => setShowChatMobile(false)}
              className="px-3 py-1.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" /> {t("serviceProvider.backToChatList")}
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <ChatWindow
              conversationId={activeConv.id}
              peerName={activeConv.peerName}
              peerAvatar={activeConv.peerAvatar}
              peerId={activeConv.peerId}
              bookingId={activeConv.bookingId}
              serviceName={activeConv.serviceName}
              bookingStatus={activeConv.bookingStatus}
              currentUserId={providerId}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs p-8 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-2" />
          <span>{t("chat.selectConversationPrompt")}</span>
        </div>
      )}

    </div>
  );
}
