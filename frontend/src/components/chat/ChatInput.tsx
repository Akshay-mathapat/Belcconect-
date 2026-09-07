"use client";

import { useState, FormEvent, KeyboardEvent, useRef, ChangeEvent } from "react";
import { Paperclip, Send, MapPin, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ChatInputProps {
  onSendMessage: (text: string, mediaUrl?: string, locationUrl?: string, latitude?: number, longitude?: number) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export default function ChatInput({ onSendMessage, onTypingStart, onTypingStop }: ChatInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const quickReplies = [
    { id: "location", label: t("chat.shareLocation") },
    { id: "onMyWay", label: t("chat.onMyWay") },
    { id: "arriving", label: t("chat.arrivingIn10Mins") },
    { id: "confirmAddress", label: t("chat.confirmAddress") },
    { id: "completed", label: t("chat.serviceCompleted") },
  ];

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (onTypingStart) onTypingStart();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 2000);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (onTypingStop) onTypingStop();
    onSendMessage(text.trim());
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Real-Time GPS Geolocation Capture
  const handleShareLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        onSendMessage("📍 Shared Live Location", undefined, locationUrl, latitude, longitude);
        setGettingLocation(false);
      },
      (error) => {
        alert("Unable to retrieve GPS location. Please check browser location permissions.");
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleQuickReply = (id: string, label: string) => {
    if (id === "location") {
      handleShareLocation();
    } else {
      onSendMessage(label);
    }
  };

  // Image & Document File Upload Handler
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed");
      }

      const data = await res.json();
      onSendMessage(file.type.startsWith("image/") ? "📷 Photo Attachment" : `📄 File: ${file.name}`, data.url);
    } catch (err: any) {
      alert(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col bg-card border-t border-border">
      {/* 1-Tap Quick Reply Chips Row */}
      <div 
        className="flex items-center gap-2 p-2 overflow-x-auto bg-muted/30 border-b border-border/50 scrollbar-none [::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {quickReplies.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={gettingLocation || uploading}
            onClick={() => handleQuickReply(chip.id, chip.label)}
            className="px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full hover:bg-blue-600 hover:text-white dark:hover:text-white transition whitespace-nowrap disabled:opacity-50 cursor-pointer shrink-0"
          >
            {chip.id === "location" && gettingLocation ? t("chat.fetchingGPS") : chip.label}
          </button>
        ))}
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,.pdf"
          className="hidden"
        />

        {/* Attachment Button */}
        <button
          type="button"
          disabled={uploading || gettingLocation}
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-muted-foreground hover:text-blue-600 rounded-xl hover:bg-muted transition disabled:opacity-50 cursor-pointer shrink-0"
          title="Attach image or PDF document"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <Paperclip className="w-4 h-4" />}
        </button>

        {/* GPS Button */}
        <button
          type="button"
          disabled={uploading || gettingLocation}
          onClick={handleShareLocation}
          className="p-2.5 text-muted-foreground hover:text-emerald-600 rounded-xl hover:bg-muted transition disabled:opacity-50 cursor-pointer shrink-0"
          title="Share live GPS location"
        >
          {gettingLocation ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <MapPin className="w-4 h-4" />}
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={gettingLocation ? t("chat.fetchingGPS") : uploading ? t("chat.uploadingAttachment") : t("chat.typeMessagePlaceholder")}
          className="flex-1 px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!text.trim() || uploading || gettingLocation}
          className="p-2.5 text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
