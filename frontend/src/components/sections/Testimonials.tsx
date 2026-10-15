"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

interface ReviewItem {
  id: string;
  name: string;
  service: string;
  rating: number;
  quote: string;
  avatar: string;
}

function TestimonialCard({ testimonial }: { testimonial: ReviewItem }) {
  return (
    <div 
      tabIndex={0}
      className="flex-shrink-0 w-[320px] sm:w-[360px] rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Rating */}
      <div className="flex items-center gap-0.5 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < testimonial.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`}
          />
        ))}
      </div>

      {/* Quote */}
      <p className="text-sm text-foreground/80 leading-relaxed mb-5 line-clamp-3">
        &ldquo;{testimonial.quote}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary">
          {testimonial.avatar}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
          <p className="text-xs text-muted-foreground">{testimonial.service}</p>
        </div>
      </div>
    </div>
  );
}

export function Testimonials() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  useEffect(() => {
    // Attempt to load genuine customer reviews from completed bookings
    fetch("/api/reviews?limit=10")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((r: Record<string, unknown>) => ({
            id: typeof r.id === "string" ? r.id : String(Math.random()),
            name: typeof r.customerName === "string" ? r.customerName : "Verified Customer",
            service: typeof r.serviceName === "string" ? r.serviceName : "Home Service",
            rating: typeof r.rating === "number" ? r.rating : 5,
            quote: typeof r.comment === "string" ? r.comment : "",
            avatar: (typeof r.customerName === "string" ? r.customerName : "C").slice(0, 2).toUpperCase(),
          })).filter((r: ReviewItem) => r.quote.trim().length > 0);
          setReviews(formatted);
        }
      })
      .catch(() => {
        // Silently ignore - do not display mock reviews
      });
  }, []);

  // TRUTH AUDIT: Mock reviews must never run in production.
  // If there are no real customer reviews yet, do not render fabricated testimonials.
  if (reviews.length === 0) {
    return null;
  }

  const doubled = [...reviews, ...reviews];

  return (
    <section className="py-20 sm:py-28 bg-muted/30 dark:bg-muted/10 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
            Real Stories
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Trusted by the community
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-lg">
            See verified feedback from customers who booked local services on BelConnect.
          </p>
        </motion.div>
      </div>

      {/* Auto-scrolling carousel */}
      <div className="relative group">
        <div className="flex gap-5 animate-marquee w-max">
          {doubled.map((testimonial, i) => (
            <TestimonialCard key={`${testimonial.id}-${i}`} testimonial={testimonial} />
          ))}
        </div>
        {/* Fade edges */}
        <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-muted/30 dark:from-[#0B0D17] to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-muted/30 dark:from-[#0B0D17] to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
