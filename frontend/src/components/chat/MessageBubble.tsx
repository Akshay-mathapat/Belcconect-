"use client";

import { useState } from "react";
import { CheckCheck, MapPin, ExternalLink, FileText, Trash2, X } from "lucide-react";

interface MessageBubbleProps {
  id: string;
  body: string;
  createdAt: string;
  isMe: boolean;
  mediaUrl?: string | null;
  locationUrl?: string | null;
  readAt?: string | null;
  onDeleteMessage?: (messageId: string) => void;
}

export default function MessageBubble({
  id,
  body,
  createdAt,
  isMe,
  mediaUrl,
  locationUrl,
  readAt,
  onDeleteMessage
}: MessageBubbleProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const isPdf = mediaUrl && mediaUrl.toLowerCase().endsWith(".pdf");

  return (
    <>
      <div 
        className={`flex flex-col my-1 group ${isMe ? "items-end" : "items-start"}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="relative flex items-center gap-1.5 max-w-[85%] sm:max-w-[70%]">
          {/* Delete Action Button for Sender */}
          {isMe && showActions && onDeleteMessage && (
            <button
              onClick={() => onDeleteMessage(id)}
              className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-opacity opacity-70 hover:opacity-100 cursor-pointer"
              title="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <div
            className={`px-4 py-2.5 rounded-2xl text-xs shadow-sm ${
              isMe
                ? "bg-blue-600 text-white rounded-br-none"
                : "bg-card border border-border text-foreground rounded-bl-none"
            }`}
          >
            {/* Render Image Attachment */}
            {mediaUrl && !isPdf && (
              <div className="mb-2 overflow-hidden rounded-xl border border-white/20">
                <img
                  src={mediaUrl}
                  alt="Attachment"
                  onClick={() => setIsPreviewOpen(true)}
                  className="max-h-60 w-full object-cover cursor-pointer hover:opacity-90 transition"
                  title="Click to view full image preview"
                />
              </div>
            )}

            {/* Render PDF Attachment */}
            {mediaUrl && isPdf && (
              <div className={`mb-2 p-2.5 rounded-xl border flex items-center gap-2 ${isMe ? "bg-white/10 border-white/20 text-white" : "bg-muted border-border text-foreground"}`}>
                <FileText className="w-5 h-5 shrink-0" />
                <div className="overflow-hidden flex-1">
                  <p className="font-bold truncate text-[11px]">PDF Document</p>
                  <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] underline hover:opacity-80 flex items-center gap-1"
                  >
                    View Document <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Render Location Card */}
            {locationUrl && (
              <div className={`mb-2 p-2.5 rounded-xl border flex flex-col gap-1.5 ${isMe ? "bg-white/10 border-white/20 text-white" : "bg-muted border-border text-foreground"}`}>
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
                  <span>Live Location Shared</span>
                </div>
                <a
                  href={locationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold underline hover:opacity-80 transition"
                >
                  🗺️ Open in Google Maps <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Message Text */}
            {body && <p className="break-words leading-relaxed text-xs">{body}</p>}

            {/* Timestamp & Read Receipts */}
            <div className={`flex items-center justify-end gap-1 text-[10px] mt-1.5 ${isMe ? "text-blue-100" : "text-muted-foreground"}`}>
              <span>{new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {isMe && (
                <CheckCheck className={`w-3.5 h-3.5 ${readAt ? "text-cyan-200 font-bold" : "text-white/60"}`} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Image Preview Modal */}
      {isPreviewOpen && mediaUrl && (
        <div
          onClick={() => setIsPreviewOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute -top-10 right-0 text-white font-bold text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition flex items-center gap-1 cursor-pointer"
            >
              <X className="w-4 h-4" /> Close
            </button>
            <img
              src={mediaUrl}
              alt="Full Preview"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
            />
          </div>
        </div>
      )}
    </>
  );
}
