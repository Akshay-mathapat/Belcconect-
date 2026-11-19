"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, BadgePercent, Wallet, Languages, Info } from "lucide-react";

export const MIN_VERIFIED_COUNT_THRESHOLD = 25;

interface MetricData {
  categoryCount?: number;
  verifiedProviders?: number;
  completedBookings?: number;
  avgRating?: number;
  reviewCount?: number;
}

export function TrustMetrics() {
  const [data, setData] = useState<MetricData | null>(null);
  const [showIdExplanation, setShowIdExplanation] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/platform/metrics")
      .then((res) => (res.ok ? res.json() : null))
      .then((metrics) => {
        if (isMounted && metrics) {
          setData(metrics);
        }
      })
      .catch(() => {
        // Fallback to truthful static baseline
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const verifiedCount = data?.verifiedProviders ?? 0;
  const hasSubstantialProviders = verifiedCount >= MIN_VERIFIED_COUNT_THRESHOLD;

  return (
    <section className="relative border-y border-border bg-muted/30 dark:bg-muted/10 py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Card 1: ID-Verified Providers */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center p-4 rounded-2xl bg-card border border-border shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#1D4ED8] dark:text-blue-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            {hasSubstantialProviders ? (
              <p className="text-3xl font-extrabold font-heading text-foreground tracking-tight">
                {verifiedCount}
              </p>
            ) : null}
            <h3 className="text-base font-bold text-foreground mt-1 flex items-center justify-center gap-1.5">
              <span>ID-verified providers</span>
              <button
                type="button"
                onClick={() => setShowIdExplanation(!showIdExplanation)}
                className="text-muted-foreground hover:text-primary transition-colors focus:outline-hidden"
                aria-label="What does ID-verified mean?"
                title="What does this mean?"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              We check each provider's ID before they appear in search.
            </p>
            {hasSubstantialProviders && (
              <span className="text-[10px] text-muted-foreground/75 mt-1">Source: Active database records</span>
            )}
          </motion.div>

          {/* Card 2: No Commission */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center p-4 rounded-2xl bg-card border border-border shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <BadgePercent className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground mt-1">
              No commission
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              0% fee taken from workers or customers. Fair and direct.
            </p>
          </motion.div>

          {/* Card 3: Pay The Provider Directly */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center p-4 rounded-2xl bg-card border border-border shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground mt-1">
              Pay the provider directly
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Settle payment directly via cash or UPI after job completion.
            </p>
          </motion.div>

          {/* Card 4: English, Hindi, Kannada, Marathi */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center p-4 rounded-2xl bg-card border border-border shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <Languages className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground mt-1">
              English, Hindi, Kannada, Marathi
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Full platform experience available in 4 languages.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
