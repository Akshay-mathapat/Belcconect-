"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  Wind,
  Zap,
  Scissors,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  CreditCard,
  ThumbsUp
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const featuredPackages = [
  {
    id: "deep-cleaning",
    title: "Deep Home Cleaning Package",
    category: "Cleaning",
    categoryId: "cleaning",
    tag: "Most Popular",
    tagColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: Sparkles,
    iconBg: "from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400",
    description: "Complete deep cleaning of kitchen, bathrooms, living spaces, and furniture.",
    highlights: [
      "Kitchen degreasing & appliance cleaning",
      "Sanitized bathroom scrubbing & tile shine",
      "Deep floor buffing & dust removal"
    ]
  },
  {
    id: "ac-service",
    title: "AC Care & Deep Maintenance",
    category: "AC Repair",
    categoryId: "ac-repair",
    tag: "Trending",
    tagColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    icon: Wind,
    iconBg: "from-sky-500/20 to-blue-500/10 text-sky-600 dark:text-sky-400",
    description: "Thorough chemical coil cleaning, gas leak testing, and cooling optimization.",
    highlights: [
      "Filter & cooling coil deep wash",
      "Refrigerant gas level & pressure check",
      "Drain pipe flushing & noise audit"
    ]
  },
  {
    id: "electrical-check",
    title: "Whole Home Electrical Safety",
    category: "Electrical",
    categoryId: "electrical",
    tag: "Essential",
    tagColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: Zap,
    iconBg: "from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-400",
    description: "Comprehensive wiring inspection, load balancing, and switchboard upgrades.",
    highlights: [
      "Short circuit & earthing safety test",
      "MCB & main distribution panel check",
      "Fixtures & heavy appliance testing"
    ]
  },
  {
    id: "doorstep-salon",
    title: "Doorstep Pamper & Salon",
    category: "Salon at Home",
    categoryId: "salon",
    tag: "Personal Care",
    tagColor: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    icon: Scissors,
    iconBg: "from-pink-500/20 to-rose-500/10 text-pink-600 dark:text-pink-400",
    description: "Relaxing salon and spa experiences delivered right to your home.",
    highlights: [
      "Single-use sealed hygiene kits",
      "Certified senior beauty stylists",
      "Facials, haircut, styling & manicures"
    ]
  }
];

const userBenefits = [
  {
    icon: Clock,
    title: "Instant Scheduling",
    description: "Pick your preferred time slot in under 60 seconds."
  },
  {
    icon: ShieldCheck,
    title: "Verified Local Pros",
    description: "Every professional is background checked & skill tested."
  },
  {
    icon: CreditCard,
    title: "Upfront Transparent Pricing",
    description: "Know what you pay before booking. No surprise fees."
  },
  {
    icon: ThumbsUp,
    title: "Service Happiness Commitment",
    description: "Not satisfied? We will re-service or make it right."
  }
];

export function FeaturedServices() {
  const { t } = useTranslation();

  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-background via-muted/30 to-background border-y border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
            Service Highlights
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Featured Services & Bundles
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
            Popular, high-demand service solutions crafted for Belagavi homes with instant doorstep delivery.
          </p>
        </motion.div>

        {/* Featured Service Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {featuredPackages.map((pkg, idx) => {
            const Icon = pkg.icon;
            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="group relative rounded-2xl border border-border bg-card p-6 flex flex-col justify-between hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300"
              >
                <div>
                  {/* Badge & Icon */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pkg.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${pkg.tagColor}`}>
                      {pkg.tag}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-heading text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {pkg.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                    {pkg.description}
                  </p>

                  {/* Feature List */}
                  <ul className="space-y-2 mb-6 border-t border-border/50 pt-4">
                    {pkg.highlights.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Link */}
                <Link
                  href={`/services?category=${pkg.categoryId}`}
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200 group/btn shadow-sm"
                >
                  <span>Explore Service</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* User Benefits Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/5 via-blue-500/5 to-cyan-500/5 p-6 sm:p-8 backdrop-blur-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {userBenefits.map((benefit, i) => {
              const Icon = benefit.icon;
              return (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-1">
                      {benefit.title}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
