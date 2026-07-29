"use client";

import { motion } from "framer-motion";
import { ShieldCheck, ThumbsUp, Clock, UserCheck } from "lucide-react";
import { SITE_NAME } from "@/constants/site";
import { useTranslation } from "@/lib/i18n";

const features = [
  { 
    icon: UserCheck, 
    title: "Verified Professionals",
    description: "Every service provider goes through a strict background check and skill verification process."
  },
  { 
    icon: Clock, 
    title: "On-Time Service",
    description: "We value your time. Our professionals are committed to arriving and completing jobs as scheduled."
  },
  { 
    icon: ThumbsUp, 
    title: "Satisfaction Guaranteed",
    description: "Not happy with the service? We'll work with you to make it right, or offer a complete refund."
  },
];

export function Guarantee() {
  const { t } = useTranslation();

  return (
    <section className="py-20 sm:py-28 bg-blue-600 dark:bg-blue-900 relative overflow-hidden text-white">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 -left-1/4 w-1/2 h-full bg-white blur-[120px] rounded-full mix-blend-overlay" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-full bg-white blur-[120px] rounded-full mix-blend-overlay" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Left: Content */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200 mb-4">
                <ShieldCheck className="h-4 w-4" />
                Our Promise
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                The {SITE_NAME} Guarantee
              </h2>
              <p className="text-lg text-blue-100 leading-relaxed mb-8 max-w-lg">
                Your peace of mind is our top priority. We stand behind every service booked through our platform to ensure you get the quality you deserve.
              </p>
            </motion.div>
          </div>

          {/* Right: Feature Cards */}
          <div className="space-y-4">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="flex gap-4 rounded-2xl bg-white/10 backdrop-blur-sm p-6 border border-white/10 hover:bg-white/20 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white">
                    <feature.icon className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-blue-100 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
