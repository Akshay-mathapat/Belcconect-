"use client";

import { useState } from "react";
import { Star, MessageSquare, CornerDownRight, ThumbsUp, ShieldCheck, Flag } from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";

export default function ReviewsPage() {
  const { reviews, replyToReview, profile } = useProviderStore();
  const [replyInput, setReplyInput] = useState<{ [id: string]: string }>({});

  const handleReplySubmit = (id: string) => {
    const text = replyInput[id];
    if (!text) return;
    replyToReview(id, text);
    setReplyInput({ ...replyInput, [id]: "" });
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Customer Reviews & Ratings
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Read customer feedback and reply directly to maintain a 5-star provider reputation.
        </p>
      </div>

      {/* Ratings Summary Breakdown Box */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="text-center p-4 rounded-2xl bg-[#1F5F5B]/10 border border-[#1F5F5B]/20">
            <span className="font-heading text-4xl font-extrabold text-[#1F5F5B] block">{profile.rating}</span>
            <div className="flex items-center justify-center gap-1 my-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-[#D4A017] text-[#D4A017]" />
              ))}
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">{profile.totalReviews} Total Reviews</span>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[200px]">
            {[5, 4, 3, 2, 1].map((stars) => (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-12 font-bold text-foreground">{stars} Stars</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-[#1F5F5B] rounded-full" 
                    style={{ width: stars === 5 ? "92%" : stars === 4 ? "8%" : "0%" }}
                  />
                </div>
                <span className="w-8 text-right font-bold text-muted-foreground">
                  {stars === 5 ? "92%" : stars === 4 ? "8%" : "0%"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 max-w-sm space-y-1">
          <span className="text-xs font-bold text-amber-800 dark:text-amber-400 block">Pro Tip for Higher Earnings</span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Replying to reviews within 24 hours increases customer re-booking likelihood by 35%.
          </p>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((rev) => (
          <div key={rev.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={rev.customerPhoto}
                  alt={rev.customerName}
                  className="w-11 h-11 rounded-full object-cover border border-border shrink-0"
                />
                <div>
                  <h3 className="text-xs font-bold text-foreground">{rev.customerName}</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-[#D4A017] text-[#D4A017]" />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">• {rev.date}</span>
                  </div>
                </div>
              </div>

              <span className="text-xs font-bold text-[#1F5F5B] bg-[#1F5F5B]/10 px-2.5 py-1 rounded-full">
                {rev.serviceName}
              </span>
            </div>

            <p className="text-xs text-foreground leading-relaxed font-medium">
              "{rev.comment}"
            </p>

            {/* Existing Reply */}
            {rev.reply ? (
              <div className="p-3.5 rounded-xl bg-[#1F5F5B]/5 border border-[#1F5F5B]/20 ml-6 flex items-start gap-2.5 text-xs">
                <CornerDownRight className="h-4 w-4 text-[#1F5F5B] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#1F5F5B] block">Your Public Reply:</span>
                  <p className="text-muted-foreground mt-0.5">{rev.reply}</p>
                </div>
              </div>
            ) : (
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Write a public reply to this review..."
                  value={replyInput[rev.id] || ""}
                  onChange={(e) => setReplyInput({ ...replyInput, [rev.id]: e.target.value })}
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-muted/40 border border-border focus:outline-none"
                />
                <button
                  onClick={() => handleReplySubmit(rev.id)}
                  className="px-4 py-2 rounded-xl bg-[#1F5F5B] text-white text-xs font-bold shadow-sm hover:bg-[#174a47]"
                >
                  Reply
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
