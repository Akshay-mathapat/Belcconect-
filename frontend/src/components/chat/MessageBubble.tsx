"use client";

import { useState, useEffect } from "react";
import { CheckCheck, MapPin, ExternalLink, FileText, Trash2, X, ImageOff, ImageIcon } from "lucide-react";

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
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const isPdf = Boolean(mediaUrl && mediaUrl.toLowerCase().endsWith(".pdf"));

  // Extract clean PDF display filename
  const pdfFileName = (() => {
    if (body && body.startsWith("📄 File:")) {
      return body.replace(/^📄 File:\s*/, "").trim();
    }
    if (mediaUrl) {
      try {
        const lastPart = mediaUrl.split("/").pop() || "";
        const clean = decodeURIComponent(lastPart).replace(/^\d{10,14}[-_]/, "");
        if (clean) return clean;
      } catch {
        // fallback
      }
    }
    return "document.pdf";
  })();

  // Close preview on Escape key press
  useEffect(() => {
    if (!isPreviewOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPreviewOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewOpen]);

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
              aria-label="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <div
            className={`px-3.5 py-2.5 rounded-2xl text-xs shadow-sm ${
              isMe
                ? "bg-blue-600 text-white rounded-br-none"
                : "bg-card border border-border text-foreground rounded-bl-none"
            }`}
          >
            {/* Render Image Attachment */}
            {mediaUrl && !isPdf && (
              <div className="mb-1.5">
                {imageError ? (
                  <div
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs ${
                      isMe
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    <ImageOff className="w-4 h-4 shrink-0 opacity-70" />
                    <span>Image unavailable</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    className={`group/img relative block overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer text-left transition-transform active:scale-[0.99] ${
                      isMe ? "border border-white/20" : "border border-border/80"
                    }`}
                    aria-label="View full image preview"
                  >
                    {imageLoading && (
                      <div className="w-52 h-40 bg-muted/40 animate-pulse flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                        <ImageIcon className="w-6 h-6 opacity-40 animate-pulse" />
                        <span className="text-[10px] opacity-60">Loading...</span>
                      </div>
                    )}
                    <img
                      src={mediaUrl}
                      alt="Attachment"
                      onLoad={() => setImageLoading(false)}
                      onError={() => {
                        setImageLoading(false);
                        setImageError(true);
                      }}
                      className={`max-w-[70vw] sm:max-w-[260px] max-h-[300px] w-auto h-auto object-cover rounded-xl transition duration-200 group-hover/img:brightness-95 ${
                        imageLoading ? "hidden" : "block"
                      }`}
                    />
                    {!imageLoading && (
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors pointer-events-none rounded-xl" />
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Render PDF Attachment */}
            {mediaUrl && isPdf && (
              <div
                className={`mb-1.5 p-2.5 rounded-xl border flex items-center gap-2.5 max-w-[260px] sm:max-w-[280px] w-full transition ${
                  isMe
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-muted/60 border-border text-foreground hover:bg-muted"
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isMe ? "bg-white/20 text-white" : "bg-red-500/10 text-red-500"
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div className="overflow-hidden flex-1 min-w-0">
                  <span className="block font-semibold text-[10px] uppercase tracking-wider opacity-75">
                    PDF Document
                  </span>
                  <p className="font-medium truncate text-xs" title={pdfFileName}>
                    {pdfFileName}
                  </p>
                  <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold underline mt-0.5 hover:opacity-80 transition ${
                      isMe ? "text-cyan-200" : "text-blue-600 dark:text-blue-400"
                    }`}
                    aria-label={`View document ${pdfFileName} in a new tab`}
                  >
                    View Document <ExternalLink className="w-3 h-3" />
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
            {body && (!isPdf || !body.startsWith("📄 File:")) && (
              <p className="break-words leading-relaxed text-xs">{body}</p>
            )}

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
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setIsPreviewOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out select-none"
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute -top-12 right-0 min-h-[44px] min-w-[44px] px-3.5 py-2 text-white font-medium text-xs bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white rounded-full transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
              aria-label="Close image preview"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
            <img
              src={mediaUrl}
              alt="Full Preview"
              className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl object-contain border border-white/10"
            />
          </div>
        </div>
      )}
    </>
  );
}
