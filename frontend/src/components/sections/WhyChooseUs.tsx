"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Tag, Zap, Lock, HeadphonesIcon, Award } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function WhyChooseUs() {
  const { t } = useTranslation();

  const features = [
    { icon: ShieldCheck, titleKey: "whyUs.verifiedTitle", descKey: "whyUs.verifiedDesc", fallbackTitle: "Verified Professionals", fallbackDesc: "Every professional undergoes strict background checks and skill verification.", gradient: "from-primary/10 to-violet-500/5" },
    { icon: Tag, titleKey: "whyUs.pricingTitle", descKey: "whyUs.pricingDesc", fallbackTitle: "Quality Assured", fallbackDesc: "High quality services delivered directly to your home by experts.", gradient: "from-emerald-500/10 to-green-500/5" },
    { icon: Zap, titleKey: "whyUs.fastTitle", descKey: "whyUs.fastDesc", fallbackTitle: "Fast Response", fallbackDesc: "Average response time under 30 minutes for most services.", gradient: "from-blue-500/10 to-cyan-500/5" },
    { icon: Lock, titleKey: "whyUs.secureTitle", descKey: "whyUs.secureDesc", fallbackTitle: "Secure Payments", fallbackDesc: "Pay securely online or in cash after the service is completed.", gradient: "from-blue-500/10 to-cyan-500/5" },
    { icon: HeadphonesIcon, titleKey: "whyUs.localTitle", descKey: "whyUs.localDesc", fallbackTitle: "Local Support", fallbackDesc: "Our Belagavi-based support team is here to help you 24/7.", gradient: "from-pink-500/10 to-rose-500/5" },
    { icon: Award, titleKey: "whyUs.guaranteeTitle", descKey: "whyUs.guaranteeDesc", fallbackTitle: "Service Guarantee", fallbackDesc: "Not satisfied? We will redo the work or refund your money.", gradient: "from-teal-500/10 to-cyan-500/5" },
  ];

  return (
    <section id="about" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
            {t("whyUs.label")}
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            {t("whyUs.title")}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-border bg-card p-6 sm:p-8 transition-all duration-300 hover:shadow-xl hover:shadow-primary/[0.03] hover:border-primary/20"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 transition-transform group-hover:scale-110`}>
                <f.icon className="h-5 w-5 text-foreground/70 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold text-foreground text-base mb-2">
                {t(f.titleKey) !== f.titleKey ? t(f.titleKey) : f.fallbackTitle}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(f.descKey) !== f.descKey ? t(f.descKey) : f.fallbackDesc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
