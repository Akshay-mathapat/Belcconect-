"use client";

import { useState } from "react";
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  Search, 
  Phone, 
  CheckCheck,
  ChevronLeft
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";
import CallButton from "@/components/calls/CallButton";

export default function MessagesPage() {
  const { conversations, sendMessage } = useProviderStore();
  const [activeBookingId, setActiveBookingId] = useState(conversations[0]?.bookingId || "");
  const [inputText, setInputText] = useState("");
  const [showChatMobile, setShowChatMobile] = useState(false);

  const activeConv = conversations.find((c) => c.bookingId === activeBookingId) || conversations[0];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(activeBookingId, inputText);
    setInputText("");
  };

  const handleSelectConv = (bookingId: string) => {
    setActiveBookingId(bookingId);
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
              <span>Customer Chats</span>
              <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">
                {conversations.length} Active
              </span>
            </h2>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search messages..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-card border border-border focus:outline-none"
              />
            </div>
          </div>

          <div className="divide-y divide-border/50 max-h-[calc(100vh-250px)] overflow-y-auto">
            {conversations.map((conv) => {
              const isSelected = conv.bookingId === activeBookingId;
              return (
                <button
                  key={conv.bookingId}
                  onClick={() => handleSelectConv(conv.bookingId)}
                  className={`w-full p-4 text-left flex items-start gap-3 transition-colors ${
                    isSelected ? "bg-blue-500/10 border-l-4 border-blue-600" : "hover:bg-muted/40"
                  }`}
                >
                  <img
                    src={conv.customerPhoto}
                    alt={conv.customerName}
                    className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                  />
                  <div className="overflow-hidden flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground truncate">{conv.customerName}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{conv.lastMessageTime}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Pane: Active Chat Window (Hidden on mobile when chat is NOT open) */}
      {activeConv ? (
        <div className={`flex-1 flex-col justify-between bg-card min-w-0 ${
          !showChatMobile ? "hidden md:flex" : "flex"
        }`}>
          
          {/* Active Header */}
          <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between bg-card">
            <div className="flex items-center gap-2.5">
              {/* Mobile Back Button */}
              <button
                onClick={() => setShowChatMobile(false)}
                className="md:hidden p-1.5 rounded-xl border border-border bg-muted/30 text-foreground"
                aria-label="Back to conversations"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <img
                src={activeConv.customerPhoto}
                alt={activeConv.customerName}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-border shrink-0"
              />
              <div className="overflow-hidden">
                <h3 className="text-xs font-bold text-foreground truncate">{activeConv.customerName}</h3>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="truncate">Active In-App Call Session</span>
                </span>
              </div>
            </div>

            <CallButton
              bookingId={activeConv.bookingId}
              title="Call Customer In-App"
            />
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-muted/20 scrollbar-thin">
            {activeConv.messages.map((m) => {
              const isProvider = m.sender === "provider";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isProvider ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-md p-3.5 rounded-2xl text-xs space-y-1 shadow-sm ${
                      isProvider
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-card border border-border text-foreground rounded-bl-none"
                    }`}
                  >
                    <p className="leading-relaxed">{m.text}</p>
                    <div className={`flex items-center justify-end gap-1 text-[9px] ${isProvider ? "text-white/70" : "text-muted-foreground"}`}>
                      <span>{m.timestamp}</span>
                      {isProvider && <CheckCheck className="h-3 w-3" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-border bg-card flex items-center gap-2">
            <button
              type="button"
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground shrink-0"
              title="Attach File"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type message..."
              className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 text-xs rounded-xl bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
          Select a customer chat to view messages
        </div>
      )}

    </div>
  );
}
