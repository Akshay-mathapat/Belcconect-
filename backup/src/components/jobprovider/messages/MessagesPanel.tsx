"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Phone, MoreVertical, Send, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Message } from "../types";
import { MOCK_MESSAGES, panelVariants } from "../mockData";
import { AvatarCircle } from "../common/AvatarCircle";

export function MessagesPanel() {
  const { t } = useTranslation();
  const [activeMsg, setActiveMsg] = useState<Message | null>(MOCK_MESSAGES[0]);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [reply, setReply] = useState("");
  const [chatHistory, setChatHistory] = useState<{ text: string; mine: boolean }[]>([
    { text: "Thank you for shortlisting me! When can I expect to hear back about the next steps?", mine: false },
    { text: "Hi Arjun, we're reviewing all shortlisted candidates and will reach out by Aug 5.", mine: true },
    { text: "Perfect! I'm available for an interview anytime after 10 AM.", mine: false },
  ]);

  const sendReply = () => {
    if (!reply.trim()) return;
    setChatHistory(prev => [...prev, { text: reply, mine: true }]);
    setReply("");
  };

  const selectMessage = (msg: Message) => {
    setActiveMsg(msg);
    setShowMobileChat(true);
  };

  return (
    <motion.div {...panelVariants}>
      <div className="mb-4">
        <h3 className="font-semibold text-xl text-foreground">{t("jobprovider.messagesTitle")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("jobprovider.communicateApplicants")}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col sm:flex-row" style={{ minHeight: "520px" }}>
        {/* Conversation list */}
        <div className={`w-full sm:w-72 border-b sm:border-b-0 sm:border-r border-border flex flex-col shrink-0 ${showMobileChat ? "hidden sm:flex" : "flex"}`}>
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder={t("jobprovider.searchConversations")} className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-xl bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground placeholder-muted-foreground" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {MOCK_MESSAGES.map(msg => (
              <div
                key={msg.id}
                onClick={() => selectMessage(msg)}
                className={`flex items-start gap-3 p-4 cursor-pointer border-b border-border last:border-0 transition-colors ${activeMsg?.id === msg.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
              >
                <div className="relative">
                  <AvatarCircle initials={msg.avatar} size="sm" />
                  {msg.unread && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <p className={`text-sm truncate ${msg.unread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{msg.from}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{msg.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.preview}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat thread */}
        {activeMsg && (
          <div className={`flex-1 flex flex-col min-w-0 ${!showMobileChat ? "hidden sm:flex" : "flex"}`}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-border">
              <button
                onClick={() => setShowMobileChat(false)}
                className="p-1.5 rounded-lg border border-border text-muted-foreground sm:hidden"
                title="Back to conversations"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <AvatarCircle initials={activeMsg.avatar} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground text-sm truncate">{activeMsg.from}</p>
                <p className="text-xs text-muted-foreground truncate">Applicant · Senior Electrician</p>
              </div>
              <div className="ml-auto flex gap-1.5 sm:gap-2 shrink-0">
                <button className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Phone className="h-4 w-4" />
                </button>
                <button className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {chatHistory.map((chat, i) => (
                <div key={i} className={`flex ${chat.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${chat.mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted/60 text-foreground rounded-bl-sm"}`}>
                    {chat.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Reply box */}
            <div className="p-3.5 sm:p-4 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendReply()}
                  placeholder={t("jobprovider.typeMessage")}
                  className="flex-1 px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm border border-border rounded-xl bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground placeholder-muted-foreground"
                />
                <button
                  onClick={sendReply}
                  className="p-2 sm:p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
